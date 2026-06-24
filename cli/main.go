package main

import (
	"context"
	"fmt"
	"os"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// version is injected at build time via -ldflags "-X main.version=...".
var version = "dev"

func main() {
	if len(os.Args) > 1 && os.Args[1] == "onboard" {
		if err := runOnboard(hasFlag("--force")); err != nil {
			fmt.Fprintf(os.Stderr, "[trello-mcp] fatal: %v\n", err)
			os.Exit(1)
		}

		return
	}

	cfg, err := loadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "[trello-mcp] fatal: %v\n", err)
		os.Exit(1)
	}

	client := NewTrelloClient(cfg)

	server := mcp.NewServer(&mcp.Implementation{
		Name:    "trello-mcp",
		Version: version,
	}, nil)

	registerTools(server, client)

	if err := server.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
		fmt.Fprintf(os.Stderr, "[trello-mcp] fatal: %v\n", err)
		os.Exit(1)
	}
}

func hasFlag(flag string) bool {
	for _, arg := range os.Args[1:] {
		if arg == flag {
			return true
		}
	}

	return false
}
