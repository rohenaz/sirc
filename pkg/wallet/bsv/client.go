package bsv

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sirc/pkg/wallet"
	"sync"
	"time"
)

// Client implements the ChainWallet interface for BSV
type Client struct {
	network    string // "mainnet" or "testnet"
	arcURL     string
	arcAPIKey  string
	wocURL     string
	keyStorage wallet.KeyStorage

	// Wallet state
	address    string
	privateKey []byte // Decrypted private key (WIF format)
	balance    *wallet.Balance
	unlocked   bool

	mu sync.RWMutex
}

// Config holds BSV wallet configuration
type Config struct {
	Network    string
	ARCURL     string
	ARCAPIKey  string
	WOCURL     string
	KeyStorage wallet.KeyStorage
}

// NewClient creates a new BSV wallet client
func NewClient(cfg Config) *Client {
	return &Client{
		network:    cfg.Network,
		arcURL:     cfg.ARCURL,
		arcAPIKey:  cfg.ARCAPIKey,
		wocURL:     cfg.WOCURL,
		keyStorage: cfg.KeyStorage,
	}
}

// Coin returns the coin type
func (c *Client) Coin() wallet.Coin {
	return wallet.CoinBSV
}

// IsInitialized returns whether the wallet has been set up
func (c *Client) IsInitialized() bool {
	return c.keyStorage.Exists(wallet.CoinBSV)
}

// Initialize creates a new wallet with the given password
func (c *Client) Initialize(password string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.IsInitialized() {
		return fmt.Errorf("wallet already initialized")
	}

	// TODO: Use go-sdk to generate keys
	// For now, create placeholder data
	keyData := struct {
		WIF     string `json:"wif"`
		Address string `json:"address"`
	}{
		WIF:     "placeholder_wif_" + fmt.Sprintf("%d", time.Now().UnixNano()),
		Address: "placeholder_address",
	}

	data, err := json.Marshal(keyData)
	if err != nil {
		return fmt.Errorf("failed to marshal key data: %w", err)
	}

	// Encrypt and save
	encrypted, err := wallet.Encrypt(data, password)
	if err != nil {
		return fmt.Errorf("failed to encrypt key data: %w", err)
	}

	if err := c.keyStorage.SaveEncrypted(wallet.CoinBSV, encrypted); err != nil {
		return fmt.Errorf("failed to save key data: %w", err)
	}

	// Set state
	c.address = keyData.Address
	c.privateKey = []byte(keyData.WIF)
	c.unlocked = true

	return nil
}

// Unlock decrypts the wallet keys
func (c *Client) Unlock(password string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.IsInitialized() {
		return fmt.Errorf("wallet not initialized")
	}

	// Load encrypted data
	encrypted, err := c.keyStorage.LoadEncrypted(wallet.CoinBSV)
	if err != nil {
		return fmt.Errorf("failed to load key data: %w", err)
	}

	// Decrypt
	data, err := wallet.Decrypt(encrypted, password)
	if err != nil {
		return fmt.Errorf("failed to decrypt: wrong password")
	}

	// Parse key data
	var keyData struct {
		WIF     string `json:"wif"`
		Address string `json:"address"`
	}
	if err := json.Unmarshal(data, &keyData); err != nil {
		return fmt.Errorf("failed to parse key data: %w", err)
	}

	c.address = keyData.Address
	c.privateKey = []byte(keyData.WIF)
	c.unlocked = true

	return nil
}

// Lock clears decrypted keys from memory
func (c *Client) Lock() {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Clear sensitive data
	for i := range c.privateKey {
		c.privateKey[i] = 0
	}
	c.privateKey = nil
	c.unlocked = false
}

// IsUnlocked returns whether the wallet is unlocked
func (c *Client) IsUnlocked() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.unlocked
}

// GetAddress returns the wallet's deposit address
func (c *Client) GetAddress() (string, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if !c.unlocked {
		return "", fmt.Errorf("wallet is locked")
	}

	return c.address, nil
}

// GetBalance returns the current balance
func (c *Client) GetBalance() (*wallet.Balance, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if !c.unlocked {
		return nil, fmt.Errorf("wallet is locked")
	}

	// TODO: Fetch real balance from WhatsOnChain
	// For now return cached or zero balance
	if c.balance != nil {
		return c.balance, nil
	}

	return &wallet.Balance{
		Coin:        wallet.CoinBSV,
		Amount:      "0.00000000",
		AmountSmall: 0,
		Confirmed:   0,
		Unconfirmed: 0,
		UpdatedAt:   time.Now(),
	}, nil
}

// RefreshBalance fetches the latest balance from the blockchain
func (c *Client) RefreshBalance() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.unlocked {
		return fmt.Errorf("wallet is locked")
	}

	// TODO: Implement WhatsOnChain balance fetch
	// GET /v1/bsv/main/address/{address}/balance

	return nil
}

// GetTransactions returns recent transactions
func (c *Client) GetTransactions(limit int) ([]*wallet.Transaction, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if !c.unlocked {
		return nil, fmt.Errorf("wallet is locked")
	}

	// TODO: Implement transaction history fetch
	return []*wallet.Transaction{}, nil
}

// Send creates and broadcasts a transaction
func (c *Client) Send(toAddress string, amount string, memo string) (*wallet.Transaction, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.unlocked {
		return nil, fmt.Errorf("wallet is locked")
	}

	if !c.ValidateAddress(toAddress) {
		return nil, fmt.Errorf("invalid BSV address")
	}

	// TODO: Implement transaction building and broadcasting with go-sdk
	// 1. Fetch UTXOs
	// 2. Build transaction
	// 3. Sign transaction
	// 4. Broadcast via ARC

	return nil, fmt.Errorf("send not yet implemented - requires go-sdk integration")
}

// ValidateAddress checks if an address is valid for BSV
func (c *Client) ValidateAddress(address string) bool {
	// Basic BSV address validation
	// Mainnet addresses start with 1 or 3
	// Testnet addresses start with m, n, or 2

	if len(address) < 26 || len(address) > 35 {
		return false
	}

	// Check for valid base58 characters
	base58Regex := regexp.MustCompile(`^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$`)
	if !base58Regex.MatchString(address) {
		return false
	}

	// Check prefix based on network
	if c.network == "mainnet" {
		return address[0] == '1' || address[0] == '3'
	} else {
		return address[0] == 'm' || address[0] == 'n' || address[0] == '2'
	}
}

// GetNetwork returns the current network
func (c *Client) GetNetwork() string {
	return c.network
}

// Close cleans up resources
func (c *Client) Close() error {
	c.Lock()
	return nil
}

// Helper to convert satoshis to BSV string
func SatoshisToBSV(satoshis int64) string {
	bsv := float64(satoshis) / 100000000.0
	return fmt.Sprintf("%.8f", bsv)
}

// Helper to convert BSV string to satoshis
func BSVToSatoshis(bsv string) (int64, error) {
	var amount float64
	if _, err := fmt.Sscanf(bsv, "%f", &amount); err != nil {
		return 0, err
	}
	return int64(amount * 100000000), nil
}
