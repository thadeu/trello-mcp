import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TrelloClient } from '../trello-client.js';
import { ensureBoardAccess, ensureCardBoardAccess, jsonResult } from './helpers.js';

export function registerTools(server: McpServer, client: TrelloClient): void {
  server.tool(
    'list_boards',
    'List Trello boards allowed by TRELLO_ALLOWED_BOARD_IDS',
    {},
    async () => jsonResult(await client.listBoards())
  );

  server.tool(
    'list_lists',
    'List lists (columns) on an allowed board',
    { board_id: z.string().describe('Trello board id') },
    async ({ board_id }) => {
      ensureBoardAccess(client, board_id);
      return jsonResult(await client.listLists(board_id));
    }
  );

  server.tool(
    'list_cards',
    'List cards on an allowed board, optionally filtered by list',
    {
      board_id: z.string().describe('Trello board id'),
      list_id: z.string().optional().describe('Optional Trello list id'),
    },
    async ({ board_id, list_id }) => {
      ensureBoardAccess(client, board_id);
      return jsonResult(await client.listCards(board_id, list_id));
    }
  );

  server.tool(
    'get_card',
    'Get a Trello card by id',
    { card_id: z.string().describe('Trello card id') },
    async ({ card_id }) => {
      await ensureCardBoardAccess(client, card_id);
      return jsonResult(await client.getCard(card_id));
    }
  );

  server.tool(
    'create_card',
    'Create a card on an allowed board list',
    {
      board_id: z.string().describe('Trello board id'),
      list_id: z.string().describe('Trello list id'),
      name: z.string().min(1).describe('Card title'),
      desc: z.string().optional().describe('Card description (markdown supported)'),
      due: z.string().optional().describe('Due date in ISO 8601 format'),
      label_ids: z.array(z.string()).optional().describe('Trello label ids'),
    },
    async ({ board_id, list_id, name, desc, due, label_ids }) => {
      ensureBoardAccess(client, board_id);

      const lists = await client.listLists(board_id);
      const list = lists.find((item) => item.id === list_id);

      if (!list) {
        throw new Error(`List ${list_id} was not found on board ${board_id}`);
      }

      return jsonResult(
        await client.createCard({
          idList: list_id,
          name,
          desc,
          due,
          idLabels: label_ids,
        })
      );
    }
  );

  server.tool(
    'update_card',
    'Update fields on an allowed-board card',
    {
      card_id: z.string().describe('Trello card id'),
      name: z.string().optional().describe('New card title'),
      desc: z.string().optional().describe('New card description'),
      due: z.string().nullable().optional().describe('Due date in ISO 8601 format, or null to clear'),
      due_complete: z.boolean().optional().describe('Mark due date complete'),
      closed: z.boolean().optional().describe('Archive the card when true'),
      label_ids: z.array(z.string()).optional().describe('Replace card labels with these ids'),
    },
    async ({ card_id, name, desc, due, due_complete, closed, label_ids }) => {
      await ensureCardBoardAccess(client, card_id);

      return jsonResult(
        await client.updateCard(card_id, {
          name,
          desc,
          due,
          dueComplete: due_complete,
          closed,
          idLabels: label_ids,
        })
      );
    }
  );

  server.tool(
    'move_card',
    'Move a card to another list on the same board',
    {
      card_id: z.string().describe('Trello card id'),
      list_id: z.string().describe('Destination list id'),
    },
    async ({ card_id, list_id }) => {
      const boardId = await ensureCardBoardAccess(client, card_id);
      const lists = await client.listLists(boardId);
      const list = lists.find((item) => item.id === list_id);

      if (!list) {
        throw new Error(`List ${list_id} was not found on board ${boardId}`);
      }

      return jsonResult(await client.moveCard(card_id, list_id));
    }
  );

  server.tool(
    'add_comment',
    'Add a comment to an allowed-board card',
    {
      card_id: z.string().describe('Trello card id'),
      text: z.string().min(1).describe('Comment body'),
    },
    async ({ card_id, text }) => {
      await ensureCardBoardAccess(client, card_id);
      return jsonResult(await client.addComment(card_id, text));
    }
  );

  server.tool(
    'archive_card',
    'Archive (close) an allowed-board card',
    {
      card_id: z.string().describe('Trello card id'),
    },
    async ({ card_id }) => {
      await ensureCardBoardAccess(client, card_id);
      return jsonResult(await client.archiveCard(card_id));
    }
  );

  server.tool(
    'add_attachment',
    'Attach a file URL or local file path to an allowed-board card',
    {
      card_id: z.string().describe('Trello card id'),
      url: z.string().url().optional().describe('Public URL for Trello to fetch and attach'),
      file_path: z.string().optional().describe('Absolute local file path to upload'),
      name: z.string().optional().describe('Attachment display name'),
      mime_type: z.string().optional().describe('MIME type when uploading a local file'),
      set_cover: z.boolean().optional().describe('Use attachment as card cover when supported'),
    },
    async ({ card_id, url, file_path, name, mime_type, set_cover }) => {
      await ensureCardBoardAccess(client, card_id);

      if (!url && !file_path) {
        throw new Error('Provide either url or file_path');
      }

      if (url && file_path) {
        throw new Error('Provide only one of url or file_path');
      }

      return jsonResult(
        await client.addAttachment({
          cardId: card_id,
          url,
          filePath: file_path,
          name,
          mimeType: mime_type,
          setCover: set_cover,
        })
      );
    }
  );
}
