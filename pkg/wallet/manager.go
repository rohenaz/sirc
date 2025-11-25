package wallet

import (
	"fmt"
	"sync"
	"time"
)

// Manager coordinates multiple cryptocurrency wallets
type Manager struct {
	wallets       map[Coin]ChainWallet
	keyStorage    KeyStorage
	txStorage     TxStorage
	priceProvider PriceProvider
	pendingTxs    map[string]*PendingTx
	lastActive    time.Time
	mu            sync.RWMutex
}

// NewManager creates a new wallet manager
func NewManager(keyStorage KeyStorage, txStorage TxStorage, priceProvider PriceProvider) *Manager {
	return &Manager{
		wallets:       make(map[Coin]ChainWallet),
		keyStorage:    keyStorage,
		txStorage:     txStorage,
		priceProvider: priceProvider,
		pendingTxs:    make(map[string]*PendingTx),
		lastActive:    time.Now(),
	}
}

// RegisterWallet adds a wallet implementation for a coin
func (m *Manager) RegisterWallet(wallet ChainWallet) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.wallets[wallet.Coin()] = wallet
}

// GetWallet returns the wallet for a specific coin
func (m *Manager) GetWallet(coin Coin) (ChainWallet, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	wallet, exists := m.wallets[coin]
	if !exists {
		return nil, fmt.Errorf("wallet not found for coin: %s", coin)
	}
	return wallet, nil
}

// GetSupportedCoins returns list of supported coins
func (m *Manager) GetSupportedCoins() []Coin {
	m.mu.RLock()
	defer m.mu.RUnlock()

	coins := make([]Coin, 0, len(m.wallets))
	for coin := range m.wallets {
		coins = append(coins, coin)
	}
	return coins
}

// IsInitialized checks if any wallet has been initialized
func (m *Manager) IsInitialized() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, wallet := range m.wallets {
		if wallet.IsInitialized() {
			return true
		}
	}
	return false
}

// IsUnlocked checks if wallets are unlocked
func (m *Manager) IsUnlocked() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, wallet := range m.wallets {
		if wallet.IsUnlocked() {
			return true
		}
	}
	return false
}

// Initialize sets up all wallets with the given password
func (m *Manager) Initialize(password string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for coin, wallet := range m.wallets {
		if err := wallet.Initialize(password); err != nil {
			return fmt.Errorf("failed to initialize %s wallet: %w", coin, err)
		}
	}
	m.lastActive = time.Now()
	return nil
}

// Unlock decrypts all wallets
func (m *Manager) Unlock(password string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for coin, wallet := range m.wallets {
		if wallet.IsInitialized() {
			if err := wallet.Unlock(password); err != nil {
				return fmt.Errorf("failed to unlock %s wallet: %w", coin, err)
			}
		}
	}
	m.lastActive = time.Now()
	return nil
}

// Lock locks all wallets
func (m *Manager) Lock() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, wallet := range m.wallets {
		wallet.Lock()
	}
	// Clear pending transactions
	m.pendingTxs = make(map[string]*PendingTx)
}

// GetStatus returns the overall wallet status
func (m *Manager) GetStatus() *WalletStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return &WalletStatus{
		Initialized: m.IsInitialized(),
		Unlocked:    m.IsUnlocked(),
		Coins:       m.GetSupportedCoins(),
		LastActive:  m.lastActive,
	}
}

// GetBalance returns balance for a specific coin
func (m *Manager) GetBalance(coin Coin) (*Balance, error) {
	wallet, err := m.GetWallet(coin)
	if err != nil {
		return nil, err
	}

	if !wallet.IsUnlocked() {
		return nil, fmt.Errorf("wallet is locked")
	}

	m.mu.Lock()
	m.lastActive = time.Now()
	m.mu.Unlock()

	return wallet.GetBalance()
}

// GetAllBalances returns balances for all coins
func (m *Manager) GetAllBalances() ([]*Balance, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var balances []*Balance
	for _, wallet := range m.wallets {
		if wallet.IsUnlocked() {
			balance, err := wallet.GetBalance()
			if err != nil {
				continue // Skip failed balances
			}
			balances = append(balances, balance)
		}
	}

	m.lastActive = time.Now()
	return balances, nil
}

// GetAddress returns the deposit address for a coin
func (m *Manager) GetAddress(coin Coin) (string, error) {
	wallet, err := m.GetWallet(coin)
	if err != nil {
		return "", err
	}

	if !wallet.IsUnlocked() {
		return "", fmt.Errorf("wallet is locked")
	}

	return wallet.GetAddress()
}

// Send initiates a transaction
func (m *Manager) Send(coin Coin, toAddress string, amount string, memo string) (*Transaction, error) {
	wallet, err := m.GetWallet(coin)
	if err != nil {
		return nil, err
	}

	if !wallet.IsUnlocked() {
		return nil, fmt.Errorf("wallet is locked")
	}

	if !wallet.ValidateAddress(toAddress) {
		return nil, fmt.Errorf("invalid %s address: %s", coin, toAddress)
	}

	m.mu.Lock()
	m.lastActive = time.Now()
	m.mu.Unlock()

	tx, err := wallet.Send(toAddress, amount, memo)
	if err != nil {
		return nil, err
	}

	// Save transaction to history
	if m.txStorage != nil {
		if err := m.txStorage.SaveTransaction(tx); err != nil {
			// Log but don't fail
			fmt.Printf("Warning: failed to save transaction: %v\n", err)
		}
	}

	return tx, nil
}

// GetTransactions returns transaction history for a coin
func (m *Manager) GetTransactions(coin Coin, limit int) ([]*Transaction, error) {
	wallet, err := m.GetWallet(coin)
	if err != nil {
		return nil, err
	}

	return wallet.GetTransactions(limit)
}

// GetPrice returns price info for a coin
func (m *Manager) GetPrice(coin Coin) (*PriceInfo, error) {
	if m.priceProvider == nil {
		return nil, fmt.Errorf("price provider not configured")
	}
	return m.priceProvider.GetPrice(coin)
}

// ValidateAddress validates an address for a coin
func (m *Manager) ValidateAddress(coin Coin, address string) bool {
	wallet, err := m.GetWallet(coin)
	if err != nil {
		return false
	}
	return wallet.ValidateAddress(address)
}

// StorePendingTx stores a pending transaction awaiting confirmation
func (m *Manager) StorePendingTx(pending *PendingTx) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pendingTxs[pending.ID] = pending
}

// GetPendingTx retrieves a pending transaction
func (m *Manager) GetPendingTx(id string) (*PendingTx, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	tx, exists := m.pendingTxs[id]
	return tx, exists
}

// RemovePendingTx removes a pending transaction
func (m *Manager) RemovePendingTx(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.pendingTxs, id)
}

// GetCurrentPendingTx returns the most recent pending transaction (if any)
func (m *Manager) GetCurrentPendingTx() *PendingTx {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var latest *PendingTx
	for _, tx := range m.pendingTxs {
		if time.Now().Before(tx.ExpiresAt) {
			if latest == nil || tx.CreatedAt.After(latest.CreatedAt) {
				latest = tx
			}
		}
	}
	return latest
}

// CheckAutoLock checks if wallet should be auto-locked due to inactivity
func (m *Manager) CheckAutoLock(timeoutMins int) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if timeoutMins <= 0 {
		return false
	}

	timeout := time.Duration(timeoutMins) * time.Minute
	if time.Since(m.lastActive) > timeout {
		return true
	}
	return false
}

// Close cleans up all wallet resources
func (m *Manager) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, wallet := range m.wallets {
		if err := wallet.Close(); err != nil {
			return err
		}
	}
	return nil
}
