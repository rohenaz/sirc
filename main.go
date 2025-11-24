package main

import (
	"embed"
	_ "embed"
	"log"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v3/pkg/application"
	"sirc/pkg/download"
	"sirc/pkg/services"
)

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/out folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

//go:embed all:frontend/out
var assets embed.FS

// main function serves as the application's entry point. It initializes the application, creates a window,
// and starts the IRC/XDCC services.
func main() {
	// Get user's home directory for downloads
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatal(err)
	}
	downloadPath := filepath.Join(homeDir, "Downloads", "SIRC")

	// Initialize services
	ircService := services.NewIRCService()
	downloadManager := download.NewManager(downloadPath, 3, nil) // Max 3 concurrent downloads
	xdccService := services.NewXDCCService(ircService, downloadManager, nil)

	// Create the Wails application
	app := application.New(application.Options{
		Name:        "wails3-nextjs",
		Description: "IRC client with XDCC downloads",
		Services: []application.Service{
			application.NewService(ircService),
			application.NewService(xdccService),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	// Create the main window
	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "wails3-nextjs",
		Width:  1400,
		Height: 900,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(17, 24, 39),
		URL:              "/",
	})

	// Run the application
	err = app.Run()
	if err != nil {
		log.Fatal(err)
	}
}
