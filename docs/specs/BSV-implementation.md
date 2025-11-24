# BSV Wallet Core Implementation Guide

## Overview

This document details the BSV blockchain components needed for SIRC wallet integration, based on the official BSV Blockchain libraries. Both Go (backend) and TypeScript (frontend) toolboxes are available.

## Required Libraries

### Go Dependencies (Backend)

```go
// go.mod additions
require (
    github.com/bsv-blockchain/go-sdk v0.x.x
    github.com/bsv-blockchain/go-wallet-toolbox v0.155.x
)
```

### TypeScript Dependencies (Frontend - Optional)

```json
// package.json additions
{
  "dependencies": {
    "@bsv/sdk": "^1.x.x",
    "@bsv/wallet-toolbox": "^1.x.x"
  }
}
```

**Note:** Most wallet operations will be handled by the Go backend. TypeScript SDK is optional for frontend-only features like address validation or QR code generation.

### Package Import Map

| Purpose | Package |
|---------|---------|
| Private/Public Keys | `github.com/bsv-blockchain/go-sdk/primitives/ec` |
| Transaction Building | `github.com/bsv-blockchain/go-sdk/transaction` |
| P2PKH Scripts | `github.com/bsv-blockchain/go-sdk/transaction/template/p2pkh` |
| Address Generation | `github.com/bsv-blockchain/go-sdk/script` |
| SPV Verification | `github.com/bsv-blockchain/go-sdk/spv` |
| Wallet Orchestration | `github.com/bsv-blockchain/go-wallet-toolbox/pkg/wallet` |
| Persistent Storage | `github.com/bsv-blockchain/go-wallet-toolbox/pkg/storage` |
| Blockchain Services | `github.com/bsv-blockchain/go-wallet-toolbox/pkg/services` |
| Background Tasks | `github.com/bsv-blockchain/go-wallet-toolbox/pkg/monitor` |

---

## Architecture Components

### 1. go-sdk (Low-Level Primitives)

The base SDK provides cryptographic primitives and transaction construction:

```
go-sdk/
├── primitives/ec/      # Elliptic curve, key generation
├── transaction/        # Transaction builder, signing
├── script/             # Bitcoin script, addresses
├── spv/                # Merkle proofs, SPV structures
├── wallet/             # Basic wallet operations
└── storage/            # Data persistence interfaces
```

### 2. go-wallet-toolbox (High-Level Wallet Framework)

Production-ready BRC-100 compliant wallet building blocks:

```
go-wallet-toolbox/
├── pkg/wallet/         # Wallet orchestration
├── pkg/storage/        # GORM-based persistence (SQLite/MySQL/Postgres)
├── pkg/services/       # ARC, WhatsOnChain, Bitails integrations
├── pkg/monitor/        # Background task processing
├── pkg/wdk/            # Transaction construction helpers
└── cmd/infra/          # Storage server (HTTP on :8100)
```

---

## Implementation Steps

### Step 1: Key Generation

```go
package bsv

import (
    "github.com/bsv-blockchain/go-sdk/primitives/ec"
    "github.com/bsv-blockchain/go-sdk/script"
)

// GenerateWallet creates a new BSV keypair
func GenerateWallet() (*Wallet, error) {
    // Generate new private key
    privateKey, err := ec.NewPrivateKey()
    if err != nil {
        return nil, err
    }

    // Derive public key and address
    publicKey := privateKey.PubKey()
    address, err := script.NewAddressFromPublicKey(publicKey, true) // mainnet
    if err != nil {
        return nil, err
    }

    return &Wallet{
        PrivateKey: privateKey,
        PublicKey:  publicKey,
        Address:    address.AddressString,
    }, nil
}

// ImportFromWIF imports existing wallet from WIF
func ImportFromWIF(wif string) (*Wallet, error) {
    privateKey, err := ec.PrivateKeyFromWif(wif)
    if err != nil {
        return nil, err
    }

    publicKey := privateKey.PubKey()
    address, err := script.NewAddressFromPublicKey(publicKey, true)
    if err != nil {
        return nil, err
    }

    return &Wallet{
        PrivateKey: privateKey,
        PublicKey:  publicKey,
        Address:    address.AddressString,
    }, nil
}
```

### Step 2: Transaction Building

```go
package bsv

import (
    "github.com/bsv-blockchain/go-sdk/transaction"
    "github.com/bsv-blockchain/go-sdk/transaction/template/p2pkh"
)

// SendBSV creates and signs a transaction
func (w *Wallet) SendBSV(toAddress string, satoshis uint64, utxos []*UTXO) (*transaction.Transaction, error) {
    tx := transaction.NewTransaction()

    // Create unlocker from private key
    unlocker, err := p2pkh.Unlock(w.PrivateKey, nil)
    if err != nil {
        return nil, err
    }

    // Add inputs from UTXOs
    for _, utxo := range utxos {
        tx.AddInput(&transaction.TransactionInput{
            SourceTXID:              utxo.TxIDBytes(),
            SourceTxOutIndex:        utxo.Vout,
            SourceTransaction:       utxo.SourceTx,
            UnlockingScriptTemplate: unlocker,
            SequenceNumber:          transaction.DefaultSequenceNumber,
        })
    }

    // Add recipient output
    recipientAddr, err := script.NewAddressFromString(toAddress)
    if err != nil {
        return nil, err
    }
    lockScript, err := p2pkh.Lock(recipientAddr)
    if err != nil {
        return nil, err
    }
    tx.AddOutput(&transaction.TransactionOutput{
        LockingScript: lockScript,
        Satoshis:      satoshis,
    })

    // Add change output (if needed)
    // ... calculate change ...

    // Sign all inputs
    if err := tx.Sign(); err != nil {
        return nil, err
    }

    return tx, nil
}
```

### Step 3: Wallet Toolbox Integration

```go
package bsv

import (
    "github.com/bsv-blockchain/go-wallet-toolbox/pkg/wallet"
    "github.com/bsv-blockchain/go-wallet-toolbox/pkg/storage"
    "github.com/bsv-blockchain/go-wallet-toolbox/pkg/services"
)

// WalletManager wraps the toolbox wallet
type WalletManager struct {
    wallet   *wallet.Wallet
    storage  *storage.Storage
    services *services.Services
}

// NewWalletManager initializes the wallet toolbox
func NewWalletManager(dbPath string) (*WalletManager, error) {
    // Initialize storage (SQLite for desktop app)
    storageConfig := storage.Config{
        Driver: "sqlite",
        DSN:    dbPath,
    }
    store, err := storage.New(storageConfig)
    if err != nil {
        return nil, err
    }

    // Initialize services (blockchain APIs)
    svcConfig := services.Config{
        ARC: services.ARCConfig{
            URL: "https://api.taal.com/arc",
            // API key from settings
        },
        WOC: services.WOCConfig{
            URL: "https://api.whatsonchain.com",
        },
    }
    svcs, err := services.New(svcConfig)
    if err != nil {
        return nil, err
    }

    // Initialize wallet
    w, err := wallet.New(wallet.Config{
        Storage:  store,
        Services: svcs,
    })
    if err != nil {
        return nil, err
    }

    return &WalletManager{
        wallet:   w,
        storage:  store,
        services: svcs,
    }, nil
}
```

### Step 4: Balance Checking

```go
// GetBalance retrieves confirmed and unconfirmed balance
func (wm *WalletManager) GetBalance() (*Balance, error) {
    // Query UTXOs from storage
    utxos, err := wm.storage.GetUTXOs(wm.wallet.Address())
    if err != nil {
        return nil, err
    }

    var confirmed, unconfirmed uint64
    for _, utxo := range utxos {
        if utxo.Confirmations > 0 {
            confirmed += utxo.Satoshis
        } else {
            unconfirmed += utxo.Satoshis
        }
    }

    return &Balance{
        Confirmed:   confirmed,
        Unconfirmed: unconfirmed,
        Total:       confirmed + unconfirmed,
    }, nil
}

// RefreshBalance syncs UTXOs from blockchain
func (wm *WalletManager) RefreshBalance() error {
    // Use WhatsOnChain to fetch current UTXOs
    utxos, err := wm.services.WOC.GetUTXOs(wm.wallet.Address())
    if err != nil {
        return err
    }

    // Update storage
    return wm.storage.UpdateUTXOs(wm.wallet.Address(), utxos)
}
```

### Step 5: Transaction Broadcasting

```go
// Broadcast sends transaction to the network via ARC
func (wm *WalletManager) Broadcast(tx *transaction.Transaction) (*BroadcastResult, error) {
    // Generate BEEF format for SPV
    beef, err := tx.BEEF()
    if err != nil {
        return nil, err
    }

    // Broadcast via ARC
    result, err := wm.services.ARC.Broadcast(beef)
    if err != nil {
        return nil, err
    }

    // Store transaction in history
    if err := wm.storage.SaveTransaction(tx, result); err != nil {
        // Log but don't fail - tx was broadcast
        log.Printf("Warning: failed to save tx to history: %v", err)
    }

    return &BroadcastResult{
        TxID:   result.TxID,
        Status: result.Status,
    }, nil
}
```

---

## Service Integrations

### ARC (Transaction Service)

ARC handles transaction broadcasting and status tracking:

```go
// ARC endpoints
POST /v1/tx           // Broadcast raw transaction
POST /v1/tx/beef      // Broadcast BEEF format (preferred)
GET  /v1/tx/{txid}    // Get transaction status
```

### WhatsOnChain (Block Explorer API)

WOC provides balance and UTXO queries:

```go
// WOC endpoints
GET /v1/bsv/main/address/{address}/balance
GET /v1/bsv/main/address/{address}/unspent
GET /v1/bsv/main/tx/{txid}
```

### Bitails (Alternative Service)

Backup service for redundancy:

```go
// Bitails endpoints
GET /api/address/{address}/utxos
POST /api/tx/broadcast
```

---

## Storage Schema

The wallet toolbox uses GORM with these models:

```go
// Wallet Actions (transactions)
type WalletAction struct {
    ID          string `gorm:"primaryKey"`
    TxID        string `gorm:"index"`
    Type        string // send, receive, tip
    Amount      int64
    Fee         int64
    Status      string // pending, confirmed, failed
    CreatedAt   time.Time
    ConfirmedAt *time.Time
    Metadata    JSON
}

// Outputs (UTXOs)
type Output struct {
    ID        string `gorm:"primaryKey"`
    TxID      string `gorm:"index"`
    Vout      uint32
    Satoshis  uint64
    Script    []byte
    Spent     bool
    SpentTxID *string
    CreatedAt time.Time
}

// Transaction Notes
type TransactionNote struct {
    TxID string `gorm:"primaryKey"`
    Note string
    Tags []string `gorm:"serializer:json"`
}
```

---

## SIRC Integration Points

### pkg/wallet/bsv/ Structure

```
pkg/wallet/
├── bsv/
│   ├── client.go       # BSVWallet implementation
│   ├── keys.go         # Key generation, WIF import/export
│   ├── tx.go           # Transaction building
│   ├── balance.go      # Balance queries
│   ├── broadcast.go    # ARC/WOC broadcasting
│   └── storage.go      # SQLite persistence
├── types.go            # Common wallet types
├── interface.go        # ChainWallet interface
└── manager.go          # MultiWallet coordinator
```

### WalletService Methods

```go
// pkg/services/wallet_service.go

type WalletService struct {
    bsvWallet *bsv.Client
    storage   *wallet.Storage
    mu        sync.RWMutex
}

// Balance operations
func (s *WalletService) GetBalance(coin string) (*Balance, error)
func (s *WalletService) RefreshBalance(coin string) error

// Address operations
func (s *WalletService) GetDepositAddress(coin string) (string, error)

// Transaction operations
func (s *WalletService) Send(coin, toAddress, amount string) (*Transaction, error)
func (s *WalletService) GetTransactions(coin string, limit int) ([]*Transaction, error)

// Wallet management
func (s *WalletService) IsUnlocked() bool
func (s *WalletService) Unlock(password string) error
func (s *WalletService) Lock()
```

---

## Configuration

### Wallet Settings (config.go addition)

```go
type WalletSettings struct {
    Enabled       bool   `json:"enabled"`
    DefaultCoin   string `json:"defaultCoin"`

    // BSV Settings
    BSVNetwork    string `json:"bsvNetwork"`    // "mainnet" | "testnet"
    ARCURL        string `json:"arcUrl"`        // ARC API endpoint
    ARCAPIKey     string `json:"arcApiKey"`     // ARC API key (encrypted)
    WOCURL        string `json:"wocUrl"`        // WhatsOnChain endpoint

    // Security
    MaxTipBSV     string `json:"maxTipBsv"`
    DailyLimitBSV string `json:"dailyLimitBsv"`
    AutoLockMins  int    `json:"autoLockMins"`
}
```

### Encrypted Key Storage

Keys stored in `~/.config/sirc/wallet/`:

```
wallet/
├── bsv.enc           # AES-256-GCM encrypted WIF
├── meta.json         # Non-sensitive metadata
└── history.db        # SQLite transaction history
```

---

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Add go-sdk and go-wallet-toolbox to go.mod
- [ ] Create `pkg/wallet/` package structure
- [ ] Implement `ChainWallet` interface
- [ ] Add encrypted key storage (AES-256-GCM)
- [ ] Add `WalletSettings` to config

### Phase 2: BSV Wallet
- [ ] Implement `pkg/wallet/bsv/client.go`
- [ ] Key generation and WIF import
- [ ] WhatsOnChain balance queries
- [ ] Transaction building with go-sdk
- [ ] ARC broadcasting

### Phase 3: WalletService
- [ ] Create `pkg/services/wallet_service.go`
- [ ] Wire up to main.go service registration
- [ ] Implement `/balance` command handler
- [ ] Implement `/deposit` command handler
- [ ] Implement `/send` command handler

### Phase 4: Frontend Integration
- [ ] Add wallet command interception to ChatInput
- [ ] Create system message display for wallet responses
- [ ] Add WalletDialog component
- [ ] Add wallet tab to SettingsDialog

---

## TypeScript SDK (Frontend Reference)

While the Go backend handles wallet operations, here are TypeScript examples for reference or optional frontend features.

### TypeScript Transaction Example

```typescript
import { Transaction, PrivateKey, P2PKH, ARC } from '@bsv/sdk'

const privKey = PrivateKey.fromWif('...')
const recipientAddress = '1Fd5F7XR8LYHPmshLNs8cXSuVAAQzGp7Hc'

const tx = new Transaction()

tx.addInput({
  sourceTransaction: Transaction.fromHex('...'),
  sourceOutputIndex: 0,
  unlockingScriptTemplate: new P2PKH().unlock(privKey),
})

tx.addOutput({
  lockingScript: new P2PKH().lock(recipientAddress),
  satoshis: 2500
})

tx.addOutput({
  lockingScript: new P2PKH().lock(changePrivKey.toPublicKey().toHash()),
  change: true
})

await tx.fee()
await tx.sign()

await tx.broadcast(new ARC('https://api.taal.com/arc', apiKey))
```

### TypeScript HD Wallet Key Derivation

```typescript
import { HD } from '@bsv/sdk'

// Generate random HD key
const randomKey = HD.fromRandom()
console.log(randomKey.toString())  // xprv9s21ZrQH143K2...

// Import existing key
const importedKey = HD.fromString('xprv...')

// Derive child keys
const child = key.derive('m/0/1/2')

// Convert to public key
const xpubKey = key.toPublic()
console.log(xpubKey.pubKey.toAddress())  // 1CJXwGLb6GMCF46A...

// Convert to WIF for backend
console.log(key.privKey.toWif())
```

### TypeScript Wallet Toolbox SQLite Example

```typescript
import { PrivateKey } from '@bsv/sdk'
import { test } from '@bsv/wallet-toolbox'

const rootKeyHex = PrivateKey.fromRandom().toString()
console.log(`ROOT KEY: ${rootKeyHex}`)

const { wallet } = await test._tu.createSQLiteTestWallet({
  filePath: './myTestWallet.sqlite',
  databaseName: 'myTestWallet',
  chain: 'test',
  rootKeyHex
})
```

### Frontend Use Cases for TypeScript SDK

| Use Case | Why Frontend? |
|----------|---------------|
| Address validation | Instant feedback, no backend call |
| QR code generation | Display deposit address |
| Amount formatting | Satoshi ↔ BSV conversion |
| Transaction preview | Show outputs before signing |

---

## References

### Go Libraries
- [go-sdk Repository](https://github.com/bsv-blockchain/go-sdk)
- [go-wallet-toolbox Repository](https://github.com/bsv-blockchain/go-wallet-toolbox)
- [BSV Skills Center - Go SDK](https://docs.bsvblockchain.org/guides/sdks/go)

### TypeScript Libraries
- [@bsv/sdk on npm](https://www.npmjs.com/package/@bsv/sdk)
- [@bsv/wallet-toolbox on npm](https://www.npmjs.com/package/@bsv/wallet-toolbox)
- [wallet-toolbox-examples](https://github.com/bsv-blockchain/wallet-toolbox-examples)
- [BSV Skills Center - TS Examples](https://docs.bsvblockchain.org/guides/sdks/ts/examples)

### Standards & APIs
- [BRC-100 Specification](https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0100.md)
- [ARC Documentation](https://docs.taal.com/arc)
- [WhatsOnChain API](https://developers.whatsonchain.com/)
