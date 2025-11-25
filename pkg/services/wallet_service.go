package services

import (
	"fmt"
	"sirc/pkg/config"
	"sirc/pkg/wallet"
	"sirc/pkg/wallet/bsv"
	"sync"
)

// WalletService handles cryptocurrency wallet operations
// This service is exposed to the frontend via Wails bindings
type WalletService struct {
	manager  *wallet.Manager
	config   *config.Config
	settings *config.WalletSettings
	mu       sync.RWMutex
}

// NewWalletService creates a new wallet service
func NewWalletService() *WalletService {
	return &WalletService{}
}

// Initialize sets up the wallet service with configuration
func (s *WalletService) Initialize() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Load config
	cfg, err := config.NewConfig()
	if err != nil {
		return fmt.Errorf("failed to create config: %w", err)
	}
	s.config = cfg

	// Load settings
	settings, err := cfg.LoadSettings()
	if err != nil {
		return fmt.Errorf("failed to load settings: %w", err)
	}
	s.settings = &settings.Wallet

	// Create storage
	keyStorage, err := wallet.NewFileKeyStorage(cfg.GetConfigDir())
	if err != nil {
		return fmt.Errorf("failed to create key storage: %w", err)
	}

	txStorage, err := wallet.NewFileTxStorage(cfg.GetConfigDir())
	if err != nil {
		return fmt.Errorf("failed to create tx storage: %w", err)
	}

	// Create wallet manager
	s.manager = wallet.NewManager(keyStorage, txStorage, nil)

	// Register BSV wallet
	bsvWallet := bsv.NewClient(bsv.Config{
		Network:    s.settings.BSVNetwork,
		ARCURL:     s.settings.ARCURL,
		ARCAPIKey:  s.settings.ARCAPIKey,
		WOCURL:     s.settings.WOCURL,
		KeyStorage: keyStorage,
	})
	s.manager.RegisterWallet(bsvWallet)

	// TODO: Register Solana wallet when implemented

	return nil
}

// IsEnabled returns whether wallet features are enabled
func (s *WalletService) IsEnabled() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.settings == nil {
		return false
	}
	return s.settings.Enabled
}

// GetStatus returns the wallet status
func (s *WalletService) GetStatus() (*wallet.WalletStatus, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.manager == nil {
		return &wallet.WalletStatus{
			Initialized: false,
			Unlocked:    false,
			Coins:       []wallet.Coin{},
		}, nil
	}

	return s.manager.GetStatus(), nil
}

// IsInitialized returns whether any wallet has been set up
func (s *WalletService) IsInitialized() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.manager == nil {
		return false
	}
	return s.manager.IsInitialized()
}

// IsUnlocked returns whether the wallet is unlocked
func (s *WalletService) IsUnlocked() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.manager == nil {
		return false
	}
	return s.manager.IsUnlocked()
}

// CreateWallet initializes a new wallet with the given password
func (s *WalletService) CreateWallet(password string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.manager == nil {
		return fmt.Errorf("wallet service not initialized")
	}

	return s.manager.Initialize(password)
}

// Unlock unlocks the wallet with the given password
func (s *WalletService) Unlock(password string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.manager == nil {
		return fmt.Errorf("wallet service not initialized")
	}

	return s.manager.Unlock(password)
}

// Lock locks the wallet
func (s *WalletService) Lock() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.manager != nil {
		s.manager.Lock()
	}
}

// GetBalance returns the balance for a specific coin
func (s *WalletService) GetBalance(coin string) (*wallet.Balance, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.manager == nil {
		return nil, fmt.Errorf("wallet service not initialized")
	}

	return s.manager.GetBalance(wallet.Coin(coin))
}

// GetAllBalances returns balances for all coins
func (s *WalletService) GetAllBalances() ([]*wallet.Balance, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.manager == nil {
		return nil, fmt.Errorf("wallet service not initialized")
	}

	return s.manager.GetAllBalances()
}

// GetDepositAddress returns the deposit address for a coin
func (s *WalletService) GetDepositAddress(coin string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.manager == nil {
		return "", fmt.Errorf("wallet service not initialized")
	}

	return s.manager.GetAddress(wallet.Coin(coin))
}

// Send sends cryptocurrency to an address
func (s *WalletService) Send(coin string, toAddress string, amount string, memo string) (*wallet.Transaction, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.manager == nil {
		return nil, fmt.Errorf("wallet service not initialized")
	}

	return s.manager.Send(wallet.Coin(coin), toAddress, amount, memo)
}

// GetTransactions returns transaction history for a coin
func (s *WalletService) GetTransactions(coin string, limit int) ([]*wallet.Transaction, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.manager == nil {
		return nil, fmt.Errorf("wallet service not initialized")
	}

	return s.manager.GetTransactions(wallet.Coin(coin), limit)
}

// ValidateAddress validates an address for a coin
func (s *WalletService) ValidateAddress(coin string, address string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.manager == nil {
		return false
	}

	return s.manager.ValidateAddress(wallet.Coin(coin), address)
}

// GetSupportedCoins returns the list of supported cryptocurrencies
func (s *WalletService) GetSupportedCoins() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.manager == nil {
		return []string{}
	}

	coins := s.manager.GetSupportedCoins()
	result := make([]string, len(coins))
	for i, c := range coins {
		result[i] = string(c)
	}
	return result
}

// ProcessCommand handles wallet IRC commands
// Returns a CommandResult that can be displayed in the chat
func (s *WalletService) ProcessCommand(command string, args []string) *wallet.CommandResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.settings.Enabled {
		return &wallet.CommandResult{
			Success: false,
			Error:   "Wallet features are disabled. Enable in Settings → Wallet.",
		}
	}

	if s.manager == nil {
		return &wallet.CommandResult{
			Success: false,
			Error:   "Wallet service not initialized.",
		}
	}

	switch command {
	case "balance":
		return s.cmdBalance(args)
	case "deposit":
		return s.cmdDeposit(args)
	case "send":
		return s.cmdSend(args)
	case "history":
		return s.cmdHistory(args)
	case "wallet":
		return s.cmdWallet(args)
	default:
		return &wallet.CommandResult{
			Success: false,
			Error:   fmt.Sprintf("Unknown wallet command: %s", command),
		}
	}
}

// cmdBalance handles /balance command
func (s *WalletService) cmdBalance(args []string) *wallet.CommandResult {
	if !s.manager.IsUnlocked() {
		return &wallet.CommandResult{
			Success: false,
			Error:   "Wallet is locked. Use /wallet unlock to unlock.",
		}
	}

	var coin wallet.Coin
	if len(args) > 0 {
		coin = wallet.Coin(args[0])
	} else {
		coin = wallet.Coin(s.settings.DefaultCoin)
	}

	balance, err := s.manager.GetBalance(coin)
	if err != nil {
		return &wallet.CommandResult{
			Success: false,
			Error:   err.Error(),
		}
	}

	return &wallet.CommandResult{
		Success: true,
		Message: fmt.Sprintf("%s Balance: %s %s", coin.DisplayName(), balance.Amount, coin.Symbol()),
		Data:    balance,
	}
}

// cmdDeposit handles /deposit command
func (s *WalletService) cmdDeposit(args []string) *wallet.CommandResult {
	if !s.manager.IsUnlocked() {
		return &wallet.CommandResult{
			Success: false,
			Error:   "Wallet is locked. Use /wallet unlock to unlock.",
		}
	}

	var coin wallet.Coin
	if len(args) > 0 {
		coin = wallet.Coin(args[0])
	} else {
		coin = wallet.Coin(s.settings.DefaultCoin)
	}

	address, err := s.manager.GetAddress(coin)
	if err != nil {
		return &wallet.CommandResult{
			Success: false,
			Error:   err.Error(),
		}
	}

	return &wallet.CommandResult{
		Success: true,
		Message: fmt.Sprintf("%s Deposit Address:\n%s", coin.DisplayName(), address),
		Data:    map[string]string{"address": address, "coin": string(coin)},
	}
}

// cmdSend handles /send command
func (s *WalletService) cmdSend(args []string) *wallet.CommandResult {
	if !s.manager.IsUnlocked() {
		return &wallet.CommandResult{
			Success: false,
			Error:   "Wallet is locked. Use /wallet unlock to unlock.",
		}
	}

	// Expected: /send <recipient> <amount> <coin> [memo]
	if len(args) < 3 {
		return &wallet.CommandResult{
			Success: false,
			Error:   "Usage: /send <recipient> <amount> <coin> [memo]",
		}
	}

	recipient := args[0]
	amount := args[1]
	coin := wallet.Coin(args[2])
	memo := ""
	if len(args) > 3 {
		for i := 3; i < len(args); i++ {
			if memo != "" {
				memo += " "
			}
			memo += args[i]
		}
	}

	// Validate address
	if !s.manager.ValidateAddress(coin, recipient) {
		return &wallet.CommandResult{
			Success: false,
			Error:   fmt.Sprintf("Invalid %s address: %s", coin, recipient),
		}
	}

	// Send transaction
	tx, err := s.manager.Send(coin, recipient, amount, memo)
	if err != nil {
		return &wallet.CommandResult{
			Success: false,
			Error:   err.Error(),
		}
	}

	return &wallet.CommandResult{
		Success: true,
		Message: fmt.Sprintf("Sent %s %s to %s\nTX: %s", tx.Amount, coin.Symbol(), recipient, tx.TxHash),
		Data:    tx,
	}
}

// cmdHistory handles /history command
func (s *WalletService) cmdHistory(args []string) *wallet.CommandResult {
	if !s.manager.IsUnlocked() {
		return &wallet.CommandResult{
			Success: false,
			Error:   "Wallet is locked. Use /wallet unlock to unlock.",
		}
	}

	var coin wallet.Coin
	limit := 10
	if len(args) > 0 {
		coin = wallet.Coin(args[0])
	} else {
		coin = wallet.Coin(s.settings.DefaultCoin)
	}

	txs, err := s.manager.GetTransactions(coin, limit)
	if err != nil {
		return &wallet.CommandResult{
			Success: false,
			Error:   err.Error(),
		}
	}

	if len(txs) == 0 {
		return &wallet.CommandResult{
			Success: true,
			Message: fmt.Sprintf("No %s transactions found.", coin.DisplayName()),
		}
	}

	return &wallet.CommandResult{
		Success: true,
		Message: fmt.Sprintf("Recent %s Transactions:", coin.DisplayName()),
		Data:    txs,
	}
}

// cmdWallet handles /wallet command
func (s *WalletService) cmdWallet(args []string) *wallet.CommandResult {
	if len(args) == 0 {
		// Show wallet overview
		status := s.manager.GetStatus()
		if !status.Initialized {
			return &wallet.CommandResult{
				Success: true,
				Message: "Wallet not initialized. Use /wallet create to set up.",
				Data:    status,
			}
		}
		if !status.Unlocked {
			return &wallet.CommandResult{
				Success: true,
				Message: "Wallet is locked. Use /wallet unlock to access.",
				Data:    status,
			}
		}

		// Get all balances
		balances, _ := s.manager.GetAllBalances()
		return &wallet.CommandResult{
			Success: true,
			Message: "Wallet Status: Unlocked",
			Data: map[string]interface{}{
				"status":   status,
				"balances": balances,
			},
		}
	}

	subCmd := args[0]
	switch subCmd {
	case "create":
		return &wallet.CommandResult{
			Success: false,
			Error:   "Wallet creation requires password. Use the Wallet dialog in Settings.",
		}
	case "unlock":
		return &wallet.CommandResult{
			Success: false,
			Error:   "Wallet unlock requires password. Use the Wallet dialog in Settings.",
		}
	case "lock":
		s.manager.Lock()
		return &wallet.CommandResult{
			Success: true,
			Message: "Wallet locked.",
		}
	default:
		return &wallet.CommandResult{
			Success: false,
			Error:   fmt.Sprintf("Unknown wallet subcommand: %s", subCmd),
		}
	}
}
