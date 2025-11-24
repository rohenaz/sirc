# Cryptocurrency Wallet Integration

## Overview

SIRC integrates cryptocurrency wallet functionality directly into the IRC client, enabling peer-to-peer payments between IRC users. The MVP supports two blockchains: **BSV (Bitcoin SV)** and **SOL (Solana)**.

## Features

- **Multi-Chain Support**: BSV and Solana wallets in a single interface
- **IRC Commands**: Native slash commands for all wallet operations
- **Peer-to-Peer Tips**: Send crypto to any NickServ-verified user
- **Non-Custodial**: Keys stored locally, encrypted at rest
- **Real-Time Balance**: Check balances without leaving IRC
- **Transaction History**: View recent sends/receives per chain

## Supported Cryptocurrencies

### Phase 1 (MVP)

| Coin | Network | Standard | Go SDK | Notes |
|------|---------|----------|--------|-------|
| BSV | Bitcoin SV | BRC-100 | `github.com/bitcoin-sv/go-sdk` | SPV validation, Paymail support |
| SOL | Solana | Native | `github.com/gagliardetto/solana-go` | Fast finality, low fees |

### Future Phases

- BTC (Bitcoin) via Lightning Network
- ETH (Ethereum) and ERC-20 tokens
- Other BSV tokens (1Sat Ordinals, Run tokens)

## IRC Commands

### Wallet Management

```
/wallet
```
Display wallet overview showing all balances and status.

**Output:**
```
=== SIRC Wallet ===
BSV:  0.00234500 BSV (~$0.12)
SOL:  1.234567890 SOL (~$185.00)
Status: Unlocked
```

---

```
/balance [coin]
```
Show balance for specific coin or all coins.

**Examples:**
```
/balance           → Shows all balances
/balance bsv       → Shows BSV balance only
/balance sol       → Shows SOL balance only
```

---

```
/deposit [coin]
```
Generate or display deposit address for a coin.

**Examples:**
```
/deposit bsv       → Shows BSV deposit address
/deposit sol       → Shows Solana deposit address
```

**Output:**
```
BSV Deposit Address: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
(Send BSV to this address to fund your wallet)
```

---

```
/withdraw <address> <amount> <coin>
```
Withdraw funds to an external address.

**Examples:**
```
/withdraw 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2 0.01 bsv
/withdraw 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU 0.5 sol
```

**Output:**
```
Withdrawal initiated:
  Amount: 0.01 BSV
  To: 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2
  Fee: 0.00000250 BSV
  TX: abc123...def456
  Status: Pending (0 confirmations)
```

---

```
/history [coin] [count]
```
Show recent transaction history.

**Examples:**
```
/history           → Last 10 transactions (all coins)
/history bsv       → Last 10 BSV transactions
/history sol 5     → Last 5 Solana transactions
```

### Peer-to-Peer Payments

```
/tip <nick> <amount> <coin> [memo]
```
Send cryptocurrency to another IRC user.

**Requirements:**
- Both sender and recipient must be identified with NickServ
- Recipient must have a SIRC wallet (or receive a claim link)

**Examples:**
```
/tip alice 0.001 bsv
/tip bob 0.1 sol Thanks for the help!
```

**Output (Sender):**
```
Tip sent to alice:
  Amount: 0.001 BSV (~$0.05)
  TX: abc123...def456
  Status: Confirmed
```

**Output (Recipient sees in channel/PM):**
```
[SIRC] You received a tip from john: 0.001 BSV (~$0.05)
       Memo: "Thanks for the help!"
       Type /wallet to view your balance
```

---

```
/price <coin>
```
Get current market price.

**Example:**
```
/price bsv
```

**Output:**
```
BSV Price: $52.34 USD
  24h Change: +2.3%
  Source: CoinGecko
```

## Architecture

### Backend Components

```
pkg/
├── wallet/
│   ├── wallet.go           # Multi-chain wallet interface
│   ├── types.go            # Common types (Balance, Transaction, etc.)
│   ├── storage.go          # Encrypted key storage
│   ├── bsv/
│   │   ├── client.go       # BSV wallet implementation
│   │   ├── keys.go         # BRC-42 key derivation
│   │   └── spv.go          # SPV validation
│   └── solana/
│       ├── client.go       # Solana wallet implementation
│       └── keys.go         # Ed25519 key management
│
├── services/
│   └── wallet_service.go   # Wails service (exposed to frontend)
│
└── config/
    └── config.go           # Add WalletSettings section
```

### Frontend Components

```
frontend/
├── components/
│   ├── WalletDialog.tsx        # Main wallet management UI
│   ├── TipDialog.tsx           # Send tip interface
│   ├── DepositDialog.tsx       # Show deposit addresses/QR
│   ├── WithdrawDialog.tsx      # Withdrawal form
│   └── TransactionHistory.tsx  # Transaction list view
│
└── lib/
    └── wallet-commands.ts      # IRC command handlers
```

### Data Flow

```
User types /tip alice 0.001 bsv
           │
           ▼
┌─────────────────────────────┐
│   IRC Message Handler       │
│   (frontend/app/page.tsx)   │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   WalletService.SendTip()   │
│   (pkg/services/wallet_*)   │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   BSV/Solana Client         │
│   (pkg/wallet/bsv or sol)   │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   Blockchain Network        │
│   (BSV mainnet / Solana)    │
└─────────────────────────────┘
           │
           ▼
       TX Confirmed
           │
           ▼
┌─────────────────────────────┐
│   Notify Recipient          │
│   (IRC PRIVMSG or NOTICE)   │
└─────────────────────────────┘
```

## Wallet Interface (Go)

### Core Types

```go
// pkg/wallet/types.go

type Coin string

const (
    CoinBSV    Coin = "bsv"
    CoinSolana Coin = "sol"
)

type Balance struct {
    Coin          Coin
    Amount        string    // Decimal string for precision
    AmountSatoshi int64     // Smallest unit (satoshis/lamports)
    Confirmed     bool
    UpdatedAt     time.Time
}

type Transaction struct {
    ID        string
    Coin      Coin
    Type      TxType    // send, receive, tip_sent, tip_received
    Amount    string
    Fee       string
    Address   string    // To/From address
    TxHash    string
    Status    TxStatus  // pending, confirmed, failed
    Memo      string
    Timestamp time.Time
}

type TxType string
const (
    TxTypeSend         TxType = "send"
    TxTypeReceive      TxType = "receive"
    TxTypeTipSent      TxType = "tip_sent"
    TxTypeTipReceived  TxType = "tip_received"
)

type TxStatus string
const (
    TxStatusPending   TxStatus = "pending"
    TxStatusConfirmed TxStatus = "confirmed"
    TxStatusFailed    TxStatus = "failed"
)
```

### Wallet Interface

```go
// pkg/wallet/wallet.go

type ChainWallet interface {
    // Key Management
    GenerateKeys(password string) error
    LoadKeys(password string) error
    IsUnlocked() bool
    Lock()

    // Addresses
    GetDepositAddress() (string, error)

    // Balance
    GetBalance() (*Balance, error)
    RefreshBalance() error

    // Transactions
    Send(toAddress string, amount string) (*Transaction, error)
    GetTransactions(limit int) ([]*Transaction, error)

    // Chain Info
    GetCoin() Coin
    GetNetwork() string
}

type MultiWallet struct {
    wallets  map[Coin]ChainWallet
    storage  *WalletStorage
    mu       sync.RWMutex
}

func (m *MultiWallet) GetBalance(coin Coin) (*Balance, error)
func (m *MultiWallet) GetAllBalances() ([]*Balance, error)
func (m *MultiWallet) Send(coin Coin, to string, amount string) (*Transaction, error)
func (m *MultiWallet) GetDepositAddress(coin Coin) (string, error)
func (m *MultiWallet) GetTransactions(coin Coin, limit int) ([]*Transaction, error)
```

### Wallet Service (Wails)

```go
// pkg/services/wallet_service.go

type WalletService struct {
    wallet     *wallet.MultiWallet
    ircService *IRCService
    mu         sync.RWMutex
}

// Exposed to frontend via Wails bindings
func (s *WalletService) GetBalances() ([]*wallet.Balance, error)
func (s *WalletService) GetDepositAddress(coin string) (string, error)
func (s *WalletService) Withdraw(coin, address, amount string) (*wallet.Transaction, error)
func (s *WalletService) GetTransactions(coin string, limit int) ([]*wallet.Transaction, error)
func (s *WalletService) GetPrice(coin string) (*PriceInfo, error)

// IRC command handlers
func (s *WalletService) SendTip(serverID, nick, amount, coin, memo string) (*wallet.Transaction, error)
func (s *WalletService) IsWalletUnlocked() bool
func (s *WalletService) UnlockWallet(password string) error
func (s *WalletService) LockWallet()
```

## BSV Implementation Details

### BRC-100 Compliance

The BSV wallet follows [BRC-100](https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0100.md) standards:

- **Key Derivation**: BRC-42 (BKDS) using secp256k1
- **Transaction Format**: BRC-62 (BEEF) for SPV compatibility
- **SPV Validation**: BRC-67 rules for lightweight verification
- **Security Levels**: BRC-43 for permission management

### Libraries

```go
import (
    "github.com/bitcoin-sv/go-sdk/transaction"
    "github.com/bitcoin-sv/go-sdk/bscript"
    "github.com/bitcoin-sv/go-sdk/ec"
)
```

### Key Features

- **SPV Validation**: Verify transactions without full node
- **UTXO Management**: Track unspent outputs efficiently
- **Fee Estimation**: Dynamic fee calculation based on tx size

## Solana Implementation Details

### Libraries

```go
import (
    "github.com/gagliardetto/solana-go"
    "github.com/gagliardetto/solana-go/rpc"
    "github.com/gagliardetto/solana-go/programs/system"
)
```

### Key Features

- **Ed25519 Keys**: Native Solana keypair generation
- **Fast Finality**: ~400ms confirmation times
- **Low Fees**: Typically <$0.001 per transaction
- **RPC Integration**: Connect to Solana mainnet/devnet

### Example: Send SOL

```go
func (c *SolanaClient) Send(toAddress string, amount string) (*Transaction, error) {
    to, err := solana.PublicKeyFromBase58(toAddress)
    if err != nil {
        return nil, err
    }

    lamports, err := parseSOLToLamports(amount)
    if err != nil {
        return nil, err
    }

    instruction := system.NewTransferInstruction(
        lamports,
        c.keypair.PublicKey(),
        to,
    ).Build()

    recent, err := c.rpc.GetRecentBlockhash(context.Background(), rpc.CommitmentFinalized)
    if err != nil {
        return nil, err
    }

    tx, err := solana.NewTransaction(
        []solana.Instruction{instruction},
        recent.Value.Blockhash,
        solana.TransactionPayer(c.keypair.PublicKey()),
    )
    if err != nil {
        return nil, err
    }

    _, err = tx.Sign(func(key solana.PublicKey) *solana.PrivateKey {
        if key.Equals(c.keypair.PublicKey()) {
            return &c.keypair.PrivateKey
        }
        return nil
    })
    if err != nil {
        return nil, err
    }

    sig, err := c.rpc.SendTransaction(context.Background(), tx)
    if err != nil {
        return nil, err
    }

    return &Transaction{
        Coin:   CoinSolana,
        TxHash: sig.String(),
        Status: TxStatusPending,
        // ...
    }, nil
}
```

## Security

### Key Storage

Keys are stored encrypted in the user's config directory:

```
~/.config/sirc/wallet/
├── bsv.enc        # Encrypted BSV private key
├── solana.enc     # Encrypted Solana keypair
└── meta.json      # Wallet metadata (non-sensitive)
```

### Encryption

- **Algorithm**: AES-256-GCM
- **Key Derivation**: Argon2id from user password
- **Salt**: Unique per-wallet, stored in meta.json

```go
func encryptKey(privateKey []byte, password string) ([]byte, error) {
    salt := make([]byte, 16)
    rand.Read(salt)

    key := argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)

    block, _ := aes.NewCipher(key)
    gcm, _ := cipher.NewGCM(block)

    nonce := make([]byte, gcm.NonceSize())
    rand.Read(nonce)

    ciphertext := gcm.Seal(nonce, nonce, privateKey, nil)
    return append(salt, ciphertext...), nil
}
```

### Transaction Limits

Configurable in Settings → Wallet:

| Setting | Default | Description |
|---------|---------|-------------|
| Max Tip Amount | 0.01 BSV / 1 SOL | Per-transaction limit |
| Daily Limit | 0.1 BSV / 10 SOL | 24-hour rolling limit |
| Require Password | Above 0.001 | Re-enter password for large txs |

### Identity Verification

Tips require NickServ verification:

1. Sender must be identified (`/msg NickServ IDENTIFY`)
2. Recipient must be registered with NickServ
3. SIRC stores mapping: NickServ account → wallet address

## Settings Integration

Add to `pkg/config/config.go`:

```go
type WalletSettings struct {
    Enabled           bool    `json:"enabled"`
    DefaultCoin       string  `json:"defaultCoin"`       // "bsv" or "sol"
    MaxTipBSV         string  `json:"maxTipBsv"`         // "0.01"
    MaxTipSOL         string  `json:"maxTipSol"`         // "1.0"
    DailyLimitBSV     string  `json:"dailyLimitBsv"`     // "0.1"
    DailyLimitSOL     string  `json:"dailyLimitSol"`     // "10.0"
    RequirePasswordAbove string `json:"requirePasswordAbove"` // "0.001"
    ShowPriceInUSD    bool    `json:"showPriceInUsd"`
    PriceSource       string  `json:"priceSource"`       // "coingecko"
    BSVNetwork        string  `json:"bsvNetwork"`        // "mainnet"
    SolanaNetwork     string  `json:"solanaNetwork"`     // "mainnet-beta"
    SolanaRPCURL      string  `json:"solanaRpcUrl"`      // Custom RPC
}
```

Add to Settings UI:

```
Settings → Wallet
├── Enable Wallet Integration [checkbox]
├── Default Coin [dropdown: BSV, SOL]
├── Security
│   ├── Max Tip Amount (BSV) [input]
│   ├── Max Tip Amount (SOL) [input]
│   ├── Daily Limit (BSV) [input]
│   ├── Daily Limit (SOL) [input]
│   └── Require Password Above [input]
├── Display
│   ├── Show Price in USD [checkbox]
│   └── Price Source [dropdown]
└── Networks
    ├── BSV Network [dropdown: mainnet, testnet]
    ├── Solana Network [dropdown: mainnet-beta, devnet]
    └── Solana RPC URL [input, optional]
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)

- [ ] Create `pkg/wallet/` package structure
- [ ] Implement wallet interface and types
- [ ] Add encrypted key storage
- [ ] Create WalletService skeleton
- [ ] Add WalletSettings to config

### Phase 2: BSV Wallet (Week 3-4)

- [ ] Integrate `bitcoin-sv/go-sdk`
- [ ] Implement key generation (BRC-42)
- [ ] Add balance checking via SPV
- [ ] Implement send transaction
- [ ] Add `/wallet`, `/balance`, `/deposit` commands

### Phase 3: Solana Wallet (Week 5-6)

- [ ] Integrate `gagliardetto/solana-go`
- [ ] Implement keypair generation
- [ ] Add balance checking via RPC
- [ ] Implement SOL transfers
- [ ] Support both BSV and SOL in commands

### Phase 4: IRC Tips (Week 7-8)

- [ ] Implement `/tip` command
- [ ] Add NickServ verification
- [ ] Create tip notification system
- [ ] Handle offline recipients (claim links?)
- [ ] Add tip history tracking

### Phase 5: UI & Polish (Week 9-10)

- [ ] Create WalletDialog component
- [ ] Add TipDialog for easy tipping
- [ ] Integrate into Settings (7th tab)
- [ ] Add transaction notifications
- [ ] QR codes for deposit addresses
- [ ] `/price` command implementation

## Testing Strategy

### Unit Tests

```go
func TestBSVWallet_GenerateKeys(t *testing.T)
func TestBSVWallet_GetBalance(t *testing.T)
func TestBSVWallet_Send(t *testing.T)
func TestSolanaWallet_GenerateKeys(t *testing.T)
func TestSolanaWallet_Send(t *testing.T)
func TestEncryption_RoundTrip(t *testing.T)
```

### Integration Tests

- Use BSV testnet for BSV testing
- Use Solana devnet for Solana testing
- Test tip flow between two test accounts

### Manual Testing Checklist

- [ ] Generate new wallet
- [ ] Lock/unlock with password
- [ ] View balances (empty, with funds)
- [ ] Get deposit address
- [ ] Send transaction (testnet)
- [ ] View transaction history
- [ ] Tip another user
- [ ] Receive tip notification

## Error Handling

| Error | User Message | Recovery |
|-------|--------------|----------|
| Wallet locked | "Wallet is locked. Use /wallet unlock" | Prompt for password |
| Insufficient funds | "Insufficient balance: have X, need Y" | Show balance |
| Invalid address | "Invalid [coin] address format" | Show address format |
| Network error | "Network error. Please try again." | Retry with backoff |
| Rate limited | "Too many requests. Wait X seconds." | Exponential backoff |
| Daily limit | "Daily limit reached (X/Y)" | Show reset time |

## Future Enhancements

1. **Paymail Support (BSV)**: Send to user@domain.com addresses
2. **Lightning Network (BTC)**: Fast Bitcoin payments
3. **Token Support**: 1Sat Ordinals, SPL tokens
4. **Channel Tips**: Public tips with leaderboard
5. **Recurring Tips**: Subscribe to tip users periodically
6. **Split Tips**: Tip multiple users at once
7. **Tip Reactions**: React to messages with micro-tips

## References

### BSV

- [BRC-100 Specification](https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0100.md)
- [BSV Go SDK](https://github.com/bitcoin-sv/go-sdk)
- [BSV Skills Center](https://docs.bsvblockchain.org/)
- [SPV Wallet](https://github.com/bitcoin-sv/spv-wallet)

### Solana

- [Solana Go SDK](https://github.com/gagliardetto/solana-go)
- [Solana Web3.js](https://solana.com/docs/clients/javascript)
- [Solana Documentation](https://solana.com/docs)

### IRC Tip Bots (Reference)

- [IRC-TipBot](https://github.com/Penait1/IRC-TipBot)
- [bitbot](https://github.com/zwily/bitbot)

## Changelog

### Version 0.1.0 (Planned)

- Initial wallet integration
- BSV and Solana support
- Core IRC commands: /wallet, /tip, /deposit, /withdraw, /balance
- Encrypted key storage
- Settings integration
