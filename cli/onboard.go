package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

func runOnboard(force bool) error {
	if err := ensureCredentialsForOnboard(); err != nil {
		return err
	}

	cfg, err := loadConfig()
	if err != nil {
		return err
	}

	return runOnboardingCLI(cfg, NewTrelloClient(cfg), force)
}

func ensureCredentialsForOnboard() error {
	if hasCredentials(mergedEnv()) {
		return nil
	}

	apiKey, token, err := promptCredentials()
	if err != nil {
		return err
	}

	if err := os.Setenv("TRELLO_API_KEY", apiKey); err != nil {
		return err
	}

	return os.Setenv("TRELLO_TOKEN", token)
}

func promptCredentials() (string, string, error) {
	fmt.Fprint(os.Stderr, "Trello credentials not found in env or MCP config.\n\n")
	fmt.Fprint(os.Stderr, "Get them at https://trello.com/power-ups/admin\n\n")

	reader := bufio.NewReader(os.Stdin)

	fmt.Fprint(os.Stderr, "Trello API key: ")
	apiKey, _ := reader.ReadString('\n')

	fmt.Fprint(os.Stderr, "Trello token: ")
	token, _ := reader.ReadString('\n')

	apiKey = strings.TrimSpace(apiKey)
	token = strings.TrimSpace(token)

	if apiKey == "" || token == "" {
		return "", "", fmt.Errorf("API key and token are required")
	}

	return apiKey, token, nil
}

func runOnboardingCLI(cfg *AppConfig, client *TrelloClient, force bool) error {
	if !force && !cfg.OnboardingRequired {
		fmt.Fprintln(os.Stderr, "Boards already configured.")
		fmt.Fprintf(os.Stderr, "Allowed board ids: %s\n", strings.Join(cfg.AllowedBoardIDs, ", "))
		fmt.Fprintf(os.Stderr, "Config file: %s\n", cfg.ConfigPath)
		fmt.Fprintln(os.Stderr, "Use --force to choose boards again.")

		return nil
	}

	all, err := client.ListAllBoards()
	if err != nil {
		return err
	}

	boards := make([]TrelloBoard, 0, len(all))
	for _, b := range all {
		if !b.Closed {
			boards = append(boards, b)
		}
	}

	if len(boards) == 0 {
		fmt.Fprintln(os.Stderr, "No open boards found for this Trello account.")
		os.Exit(1)
	}

	printBoards(boards)

	reader := bufio.NewReader(os.Stdin)
	fmt.Fprint(os.Stderr, "Select boards by number, id, or name (comma-separated): ")
	answer, _ := reader.ReadString('\n')

	selected := parseBoardSelection(answer, boards)

	if len(selected) == 0 {
		fmt.Fprintln(os.Stderr, "No valid board selection.")
		fmt.Fprintln(os.Stderr, "Use list numbers (1, 2), board ids, or board names.")
		os.Exit(1)
	}

	boardIDs := make([]string, 0, len(selected))
	for _, b := range selected {
		boardIDs = append(boardIDs, b.ID)
	}

	if err := saveAllowedBoardIDs(cfg.ConfigPath, boardIDs); err != nil {
		return err
	}

	fmt.Fprintf(os.Stderr, "\nSaved %d board(s) to %s\n", len(boardIDs), cfg.ConfigPath)

	for _, b := range selected {
		fmt.Fprintf(os.Stderr, "  - %s (%s)\n", b.Name, b.ID)
	}

	fmt.Fprintln(os.Stderr, "\nOptional MCP env override:")
	fmt.Fprintf(os.Stderr, "TRELLO_ALLOWED_BOARD_IDS=%s\n", strings.Join(boardIDs, ","))

	return nil
}

func printBoards(boards []TrelloBoard) {
	fmt.Fprint(os.Stderr, "Available boards:\n\n")

	for i, board := range boards {
		fmt.Fprintf(os.Stderr, "  %d. %s\n", i+1, board.Name)
		fmt.Fprintf(os.Stderr, "     id:  %s\n", board.ID)
		fmt.Fprintf(os.Stderr, "     url: %s\n\n", board.URL)
	}
}

func parseBoardSelection(answer string, boards []TrelloBoard) []TrelloBoard {
	selected := []TrelloBoard{}
	seen := map[string]bool{}

	for _, token := range strings.Split(answer, ",") {
		token = strings.TrimSpace(token)
		if token == "" {
			continue
		}

		board := matchBoard(token, boards)
		if board != nil && !seen[board.ID] {
			seen[board.ID] = true
			selected = append(selected, *board)
		}
	}

	return selected
}

func matchBoard(token string, boards []TrelloBoard) *TrelloBoard {
	if n, err := strconv.Atoi(token); err == nil && n >= 1 && n <= len(boards) {
		return &boards[n-1]
	}

	for i := range boards {
		if boards[i].ID == token {
			return &boards[i]
		}
	}

	lower := strings.ToLower(token)

	for i := range boards {
		if strings.ToLower(boards[i].Name) == lower {
			return &boards[i]
		}
	}

	for i := range boards {
		if strings.Contains(strings.ToLower(boards[i].Name), lower) {
			return &boards[i]
		}
	}

	return nil
}
