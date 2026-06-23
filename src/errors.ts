export class TrelloMcpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrelloMcpError';
  }
}

export class ConfigError extends TrelloMcpError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class BoardAccessError extends TrelloMcpError {
  constructor(boardId: string) {
    super(`Board ${boardId} is not in TRELLO_ALLOWED_BOARD_IDS`);
    this.name = 'BoardAccessError';
  }
}

export class TrelloApiError extends TrelloMcpError {
  readonly status: number;

  constructor(status: number, message: string) {
    super(`Trello API error (${status}): ${message}`);
    this.name = 'TrelloApiError';
    this.status = status;
  }
}
