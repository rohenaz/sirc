package dcc

import (
	"sync"
	"time"
)

// TransferType represents the type of DCC transfer
type TransferType string

const (
	TransferTypeSend   TransferType = "SEND"
	TransferTypeResume TransferType = "RESUME"
	TransferTypeAccept TransferType = "ACCEPT"
)

// TransferStatus represents the status of a transfer
type TransferStatus string

const (
	StatusPending    TransferStatus = "pending"
	StatusConnecting TransferStatus = "connecting"
	StatusActive     TransferStatus = "active"
	StatusPaused     TransferStatus = "paused"
	StatusCompleted  TransferStatus = "completed"
	StatusFailed     TransferStatus = "failed"
	StatusCancelled  TransferStatus = "cancelled"
)

// Transfer represents a DCC file transfer
type Transfer struct {
	ID           string         `json:"id"`
	Bot          string         `json:"bot"`
	PackNumber   int            `json:"packNumber"`
	FileName     string         `json:"fileName"`
	FileSize     int64          `json:"fileSize"`
	Downloaded   int64          `json:"downloaded"`
	Speed        int64          `json:"speed"` // bytes per second
	Status       TransferStatus `json:"status"`
	IP           string         `json:"ip"`
	Port         int            `json:"port"`
	Token        string         `json:"token,omitempty"` // For passive DCC
	StartTime    time.Time      `json:"startTime"`
	EndTime      time.Time      `json:"endTime,omitempty"`
	Error        string         `json:"error,omitempty"`
	SavePath     string         `json:"savePath"`
	ResumePos    int64          `json:"resumePos"`
	conn         interface{}    // net.Conn
	mu           sync.RWMutex
	cancelCh     chan struct{}
	progressCh   chan int64
}

// XDCCPack represents an XDCC pack listing
type XDCCPack struct {
	Bot        string `json:"bot"`
	PackNumber int    `json:"packNumber"`
	FileName   string `json:"fileName"`
	FileSize   int64  `json:"fileSize"`
	Gets       int    `json:"gets"`
}
