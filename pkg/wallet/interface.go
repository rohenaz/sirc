package wallet

// ChainWallet defines the interface for a cryptocurrency wallet implementation
type ChainWallet interface {
	// Coin returns which cryptocurrency this wallet handles
	Coin() Coin

	// Initialize sets up the wallet (called once on first use)
	Initialize(password string) error

	// IsInitialized returns whether the wallet has been set up
	IsInitialized() bool

	// Unlock decrypts the wallet keys with the given password
	Unlock(password string) error

	// Lock clears decrypted keys from memory
	Lock()

	// IsUnlocked returns whether the wallet is currently unlocked
	IsUnlocked() bool

	// GetAddress returns the wallet's deposit address
	GetAddress() (string, error)

	// GetBalance returns the current balance
	GetBalance() (*Balance, error)

	// RefreshBalance fetches the latest balance from the blockchain
	RefreshBalance() error

	// GetTransactions returns recent transactions
	GetTransactions(limit int) ([]*Transaction, error)

	// Send creates and broadcasts a transaction
	Send(toAddress string, amount string, memo string) (*Transaction, error)

	// ValidateAddress checks if an address is valid for this coin
	ValidateAddress(address string) bool

	// GetNetwork returns the current network (mainnet/testnet)
	GetNetwork() string

	// Close cleans up resources
	Close() error
}

// PriceProvider defines the interface for fetching price data
type PriceProvider interface {
	// GetPrice returns current price info for a coin
	GetPrice(coin Coin) (*PriceInfo, error)

	// GetPrices returns prices for multiple coins
	GetPrices(coins []Coin) (map[Coin]*PriceInfo, error)
}

// KeyStorage defines the interface for secure key storage
type KeyStorage interface {
	// SaveEncrypted saves encrypted key data
	SaveEncrypted(coin Coin, data []byte) error

	// LoadEncrypted loads encrypted key data
	LoadEncrypted(coin Coin) ([]byte, error)

	// Exists checks if key data exists for a coin
	Exists(coin Coin) bool

	// Delete removes key data for a coin
	Delete(coin Coin) error
}

// TxStorage defines the interface for transaction history storage
type TxStorage interface {
	// SaveTransaction persists a transaction
	SaveTransaction(tx *Transaction) error

	// GetTransactions retrieves transactions for a coin
	GetTransactions(coin Coin, limit int) ([]*Transaction, error)

	// GetTransaction retrieves a specific transaction by ID
	GetTransaction(id string) (*Transaction, error)

	// UpdateTransaction updates an existing transaction
	UpdateTransaction(tx *Transaction) error
}
