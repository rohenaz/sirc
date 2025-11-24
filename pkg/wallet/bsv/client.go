package bsv

import (
	"encoding/json"
	"fmt"
	"sirc/pkg/wallet"
	"sync"
	"time"

	sdkec "github.com/bsv-blockchain/go-sdk/primitives/ec"
	sdkscript "github.com/bsv-blockchain/go-sdk/script"
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

	// Generate new private key using go-sdk
	privKey, err := sdkec.NewPrivateKey()
	if err != nil {
		return fmt.Errorf("failed to generate private key: %w", err)
	}

	// Get WIF encoding (mainnet or testnet prefix)
	var wif string
	if c.network == "mainnet" {
		wif = privKey.Wif()
	} else {
		// Testnet WIF prefix is 0xef
		wif = privKey.WifPrefix(0xef)
	}

	// Derive address from public key using go-sdk
	pubKey := privKey.PubKey()
	isMainnet := c.network == "mainnet"
	addr, err := sdkscript.NewAddressFromPublicKey(pubKey, isMainnet)
	if err != nil {
		return fmt.Errorf("failed to derive address: %w", err)
	}

	// Prepare key data for storage
	keyData := struct {
		WIF     string `json:"wif"`
		Address string `json:"address"`
	}{
		WIF:     wif,
		Address: addr.AddressString,
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

// ValidateAddress checks if an address is valid for BSV using go-sdk
func (c *Client) ValidateAddress(address string) bool {
	// Use go-sdk to parse and validate the address
	// This handles base58 decoding, checksum verification, and prefix checking
	addr, err := sdkscript.NewAddressFromString(address)
	if err != nil {
		return false
	}

	// Verify network matches
	// Mainnet prefix is 0x00, testnet prefix is 0x6f
	if c.network == "mainnet" {
		// Mainnet addresses start with 1
		return len(addr.AddressString) > 0 && addr.AddressString[0] == '1'
	}
	// Testnet addresses start with m or n
	return len(addr.AddressString) > 0 && (addr.AddressString[0] == 'm' || addr.AddressString[0] == 'n')
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
