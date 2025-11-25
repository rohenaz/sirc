package wallet

import (
	"time"
)

// Coin represents a supported cryptocurrency
type Coin string

const (
	CoinBSV    Coin = "bsv"
	CoinSolana Coin = "sol"
)

// String returns the string representation of the coin
func (c Coin) String() string {
	return string(c)
}

// DisplayName returns the human-readable name
func (c Coin) DisplayName() string {
	switch c {
	case CoinBSV:
		return "Bitcoin SV"
	case CoinSolana:
		return "Solana"
	default:
		return string(c)
	}
}

// Symbol returns the currency symbol
func (c Coin) Symbol() string {
	switch c {
	case CoinBSV:
		return "BSV"
	case CoinSolana:
		return "SOL"
	default:
		return string(c)
	}
}

// Balance represents a wallet balance
type Balance struct {
	Coin        Coin      `json:"coin"`
	Amount      string    `json:"amount"`      // Decimal string for display (e.g., "0.00123456")
	AmountSmall int64     `json:"amountSmall"` // Smallest unit (satoshis for BSV, lamports for SOL)
	Confirmed   int64     `json:"confirmed"`   // Confirmed balance in smallest unit
	Unconfirmed int64     `json:"unconfirmed"` // Unconfirmed/pending balance
	PriceUSD    float64   `json:"priceUsd"`    // Current price in USD (0 if unavailable)
	ValueUSD    float64   `json:"valueUsd"`    // Total value in USD
	UpdatedAt   time.Time `json:"updatedAt"`
}

// TxType represents the type of transaction
type TxType string

const (
	TxTypeSend        TxType = "send"
	TxTypeReceive     TxType = "receive"
	TxTypeTipSent     TxType = "tip_sent"
	TxTypeTipReceived TxType = "tip_received"
)

// TxStatus represents the status of a transaction
type TxStatus string

const (
	TxStatusPending   TxStatus = "pending"
	TxStatusConfirmed TxStatus = "confirmed"
	TxStatusFailed    TxStatus = "failed"
)

// Transaction represents a wallet transaction
type Transaction struct {
	ID            string    `json:"id"`
	Coin          Coin      `json:"coin"`
	Type          TxType    `json:"type"`
	Amount        string    `json:"amount"`        // Decimal string
	AmountSmall   int64     `json:"amountSmall"`   // Smallest unit
	Fee           string    `json:"fee"`           // Fee in decimal
	FeeSmall      int64     `json:"feeSmall"`      // Fee in smallest unit
	Address       string    `json:"address"`       // To/From address
	TxHash        string    `json:"txHash"`        // Blockchain transaction hash
	Status        TxStatus  `json:"status"`
	Confirmations int       `json:"confirmations"`
	Memo          string    `json:"memo"`      // Optional memo/note
	Recipient     string    `json:"recipient"` // IRC nick if applicable
	Timestamp     time.Time `json:"timestamp"`
}

// UTXO represents an unspent transaction output (for BSV)
type UTXO struct {
	TxID          string `json:"txid"`
	Vout          uint32 `json:"vout"`
	Amount        int64  `json:"amount"` // Satoshis
	ScriptPubKey  string `json:"scriptPubKey"`
	Confirmations int    `json:"confirmations"`
}

// PendingTx represents a transaction awaiting confirmation from user
type PendingTx struct {
	ID          string    `json:"id"`
	Coin        Coin      `json:"coin"`
	ToAddress   string    `json:"toAddress"`
	ToNick      string    `json:"toNick"` // IRC nick if applicable
	Amount      string    `json:"amount"`
	AmountSmall int64     `json:"amountSmall"`
	Fee         string    `json:"fee"`
	FeeSmall    int64     `json:"feeSmall"`
	Memo        string    `json:"memo"`
	CreatedAt   time.Time `json:"createdAt"`
	ExpiresAt   time.Time `json:"expiresAt"` // Auto-cancel after expiry
}

// PriceInfo represents current price information
type PriceInfo struct {
	Coin         Coin      `json:"coin"`
	PriceUSD     float64   `json:"priceUsd"`
	Change24h    float64   `json:"change24h"`    // Percentage
	Change7d     float64   `json:"change7d"`     // Percentage
	Source       string    `json:"source"`       // e.g., "coingecko"
	LastUpdated  time.Time `json:"lastUpdated"`
}

// WalletStatus represents the overall wallet status
type WalletStatus struct {
	Initialized bool      `json:"initialized"` // Has wallet been created
	Unlocked    bool      `json:"unlocked"`    // Is wallet currently unlocked
	Coins       []Coin    `json:"coins"`       // Supported coins
	LastActive  time.Time `json:"lastActive"`  // For auto-lock
}

// CommandResult represents the result of a wallet command
type CommandResult struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}
