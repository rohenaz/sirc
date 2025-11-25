package wallet

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	sdkaesgcm "github.com/bsv-blockchain/go-sdk/primitives/aesgcm"
	sdkhash "github.com/bsv-blockchain/go-sdk/primitives/hash"
	"golang.org/x/crypto/argon2"
)

// FileKeyStorage implements KeyStorage using encrypted files
type FileKeyStorage struct {
	baseDir string
}

// NewFileKeyStorage creates a new file-based key storage
func NewFileKeyStorage(baseDir string) (*FileKeyStorage, error) {
	walletDir := filepath.Join(baseDir, "wallet")
	if err := os.MkdirAll(walletDir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create wallet directory: %w", err)
	}
	return &FileKeyStorage{baseDir: walletDir}, nil
}

// SaveEncrypted saves encrypted key data for a coin
func (s *FileKeyStorage) SaveEncrypted(coin Coin, data []byte) error {
	filePath := filepath.Join(s.baseDir, fmt.Sprintf("%s.enc", coin))
	return os.WriteFile(filePath, data, 0600)
}

// LoadEncrypted loads encrypted key data for a coin
func (s *FileKeyStorage) LoadEncrypted(coin Coin) ([]byte, error) {
	filePath := filepath.Join(s.baseDir, fmt.Sprintf("%s.enc", coin))
	return os.ReadFile(filePath)
}

// Exists checks if key data exists for a coin
func (s *FileKeyStorage) Exists(coin Coin) bool {
	filePath := filepath.Join(s.baseDir, fmt.Sprintf("%s.enc", coin))
	_, err := os.Stat(filePath)
	return err == nil
}

// Delete removes key data for a coin
func (s *FileKeyStorage) Delete(coin Coin) error {
	filePath := filepath.Join(s.baseDir, fmt.Sprintf("%s.enc", coin))
	return os.Remove(filePath)
}

// FileTxStorage implements TxStorage using a JSON file
type FileTxStorage struct {
	filePath string
	txs      map[string]*Transaction
}

// NewFileTxStorage creates a new file-based transaction storage
func NewFileTxStorage(baseDir string) (*FileTxStorage, error) {
	filePath := filepath.Join(baseDir, "wallet", "transactions.json")

	storage := &FileTxStorage{
		filePath: filePath,
		txs:      make(map[string]*Transaction),
	}

	// Load existing transactions if file exists
	if data, err := os.ReadFile(filePath); err == nil {
		var txs []*Transaction
		if err := json.Unmarshal(data, &txs); err == nil {
			for _, tx := range txs {
				storage.txs[tx.ID] = tx
			}
		}
	}

	return storage, nil
}

// SaveTransaction persists a transaction
func (s *FileTxStorage) SaveTransaction(tx *Transaction) error {
	s.txs[tx.ID] = tx
	return s.save()
}

// GetTransactions retrieves transactions for a coin
func (s *FileTxStorage) GetTransactions(coin Coin, limit int) ([]*Transaction, error) {
	var result []*Transaction
	for _, tx := range s.txs {
		if tx.Coin == coin {
			result = append(result, tx)
		}
	}

	// Sort by timestamp descending (newest first)
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].Timestamp.After(result[i].Timestamp) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	if limit > 0 && len(result) > limit {
		result = result[:limit]
	}

	return result, nil
}

// GetTransaction retrieves a specific transaction by ID
func (s *FileTxStorage) GetTransaction(id string) (*Transaction, error) {
	tx, exists := s.txs[id]
	if !exists {
		return nil, fmt.Errorf("transaction not found: %s", id)
	}
	return tx, nil
}

// UpdateTransaction updates an existing transaction
func (s *FileTxStorage) UpdateTransaction(tx *Transaction) error {
	s.txs[tx.ID] = tx
	return s.save()
}

func (s *FileTxStorage) save() error {
	var txs []*Transaction
	for _, tx := range s.txs {
		txs = append(txs, tx)
	}

	data, err := json.MarshalIndent(txs, "", "  ")
	if err != nil {
		return err
	}

	// Ensure directory exists
	dir := filepath.Dir(s.filePath)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}

	return os.WriteFile(s.filePath, data, 0600)
}

// Encryption utilities using BSV go-sdk primitives

const (
	saltSize  = 16 // Salt for key derivation
	nonceSize = 12 // Standard GCM nonce size
	tagSize   = 16 // GCM authentication tag size
)

// DeriveKey derives an AES-256 key from a password using Argon2id
// Note: go-sdk doesn't provide a KDF, so we use argon2 from x/crypto
func DeriveKey(password string, salt []byte) []byte {
	return argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)
}

// Encrypt encrypts data using AES-256-GCM via go-sdk
// Format: salt (16) + nonce (12) + ciphertext + tag (16)
func Encrypt(plaintext []byte, password string) ([]byte, error) {
	// Generate random salt for key derivation
	salt := make([]byte, saltSize)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("failed to generate salt: %w", err)
	}

	// Derive key from password
	key := DeriveKey(password, salt)

	// Generate random nonce/IV
	nonce := make([]byte, nonceSize)
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt using go-sdk's AES-GCM
	ciphertext, tag, err := sdkaesgcm.AESGCMEncrypt(plaintext, key, nonce, nil)
	if err != nil {
		return nil, fmt.Errorf("encryption failed: %w", err)
	}

	// Combine: salt + nonce + ciphertext + tag
	result := make([]byte, saltSize+nonceSize+len(ciphertext)+len(tag))
	copy(result[0:], salt)
	copy(result[saltSize:], nonce)
	copy(result[saltSize+nonceSize:], ciphertext)
	copy(result[saltSize+nonceSize+len(ciphertext):], tag)

	return result, nil
}

// Decrypt decrypts data using AES-256-GCM via go-sdk
// Expected format: salt (16) + nonce (12) + ciphertext + tag (16)
func Decrypt(data []byte, password string) ([]byte, error) {
	minLen := saltSize + nonceSize + tagSize
	if len(data) < minLen {
		return nil, fmt.Errorf("ciphertext too short: need at least %d bytes", minLen)
	}

	// Extract components
	salt := data[:saltSize]
	nonce := data[saltSize : saltSize+nonceSize]
	ciphertext := data[saltSize+nonceSize : len(data)-tagSize]
	tag := data[len(data)-tagSize:]

	// Derive key from password
	key := DeriveKey(password, salt)

	// Decrypt using go-sdk's AES-GCM
	plaintext, err := sdkaesgcm.AESGCMDecrypt(ciphertext, key, nonce, nil, tag)
	if err != nil {
		return nil, fmt.Errorf("decryption failed (wrong password?): %w", err)
	}

	return plaintext, nil
}

// HashPassword creates a SHA256 hash of the password using go-sdk
func HashPassword(password string) []byte {
	return sdkhash.Sha256([]byte(password))
}
