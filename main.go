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
	settingsService := services.NewSettingsService()
	walletService := services.NewWalletService()

	// Initialize wallet service (non-blocking, logs errors)
	go func() {
		if err := walletService.Initialize(); err != nil {
			log.Printf("Warning: wallet service initialization failed: %v", err)
		}
	}()

	// Create the Wails application
	app := application.New(application.Options{
		Name:        "SIRC",
		Description: "IRC client with XDCC downloads",
		Services: []application.Service{
			application.NewService(ircService),
			application.NewService(xdccService),
			application.NewService(settingsService),
			application.NewService(walletService),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	// Create application menu
	appMenu := app.NewMenu()

	// File menu
	fileMenu := appMenu.AddSubmenu("File")
	fileMenu.Add("Settings...").SetAccelerator("CmdOrCtrl+,").OnClick(func(ctx *application.Context) {
		// Emit event to open settings dialog
		app.EmitEvent("open-settings")
	})
	fileMenu.AddSeparator()
	fileMenu.Add("Quit").SetAccelerator("CmdOrCtrl+Q").OnClick(func(ctx *application.Context) {
		app.Quit()
	})

	// Edit menu
	editMenu := appMenu.AddSubmenu("Edit")
	editMenu.Add("Cut").SetAccelerator("CmdOrCtrl+X").OnClick(func(ctx *application.Context) {
		app.EmitEvent("edit-cut")
	})
	editMenu.Add("Copy").SetAccelerator("CmdOrCtrl+C").OnClick(func(ctx *application.Context) {
		app.EmitEvent("edit-copy")
	})
	editMenu.Add("Paste").SetAccelerator("CmdOrCtrl+V").OnClick(func(ctx *application.Context) {
		app.EmitEvent("edit-paste")
	})

	// View menu
	viewMenu := appMenu.AddSubmenu("View")
	viewMenu.Add("Reload").SetAccelerator("CmdOrCtrl+R").OnClick(func(ctx *application.Context) {
		app.EmitEvent("view-reload")
	})
	viewMenu.Add("Toggle Developer Tools").SetAccelerator("F12").OnClick(func(ctx *application.Context) {
		app.EmitEvent("view-devtools")
	})

	// Window menu
	windowMenu := appMenu.AddSubmenu("Window")
	windowMenu.Add("Minimize").SetAccelerator("CmdOrCtrl+M").OnClick(func(ctx *application.Context) {
		app.EmitEvent("window-minimize")
	})
	windowMenu.Add("Zoom").OnClick(func(ctx *application.Context) {
		app.EmitEvent("window-zoom")
	})

	// Help menu
	helpMenu := appMenu.AddSubmenu("Help")
	helpMenu.Add("Keyboard Shortcuts").SetAccelerator("CmdOrCtrl+/").OnClick(func(ctx *application.Context) {
		app.EmitEvent("open-keyboard-shortcuts")
	})
	helpMenu.Add("About SIRC").OnClick(func(ctx *application.Context) {
		app.EmitEvent("open-about")
	})

	// Set the menu
	app.SetMenu(appMenu)

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
