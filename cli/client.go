package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

const trelloAPIBase = "https://api.trello.com/1"

type TrelloBoard struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	URL    string `json:"url"`
	Closed bool   `json:"closed"`
}

type TrelloList struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Closed  bool   `json:"closed"`
	IDBoard string `json:"idBoard"`
}

type TrelloLabel struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	Color *string `json:"color"`
}

type TrelloCard struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Desc        string        `json:"desc"`
	URL         string        `json:"url"`
	Closed      bool          `json:"closed"`
	IDBoard     string        `json:"idBoard"`
	IDList      string        `json:"idList"`
	Due         *string       `json:"due"`
	DueComplete bool          `json:"dueComplete"`
	Labels      []TrelloLabel `json:"labels"`
}

type TrelloAttachment struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	URL      string  `json:"url"`
	MimeType *string `json:"mimeType"`
	Bytes    *int64  `json:"bytes"`
	Date     string  `json:"date"`
	IsUpload bool    `json:"isUpload"`
}

type CardWithAttachments struct {
	TrelloCard
	Attachments []TrelloAttachment `json:"attachments"`
}

type CreateCardInput struct {
	IDList   string
	Name     string
	Desc     *string
	Due      *string
	IDLabels []string
}

type UpdateCardInput struct {
	Name        *string
	Desc        *string
	Due         *string
	DueComplete *bool
	Closed      *bool
	IDLabels    []string
}

type AddAttachmentInput struct {
	CardID   string
	URL      *string
	FilePath *string
	Name     *string
	MimeType *string
	SetCover *bool
}

// TrelloAPIError mirrors the TS TrelloApiError class.
type TrelloAPIError struct {
	Status  int
	Message string
}

func (e *TrelloAPIError) Error() string {
	return fmt.Sprintf("Trello API error (%d): %s", e.Status, e.Message)
}

type TrelloClient struct {
	cfg  *AppConfig
	http *http.Client
}

func NewTrelloClient(cfg *AppConfig) *TrelloClient {
	return &TrelloClient{cfg: cfg, http: &http.Client{}}
}

func (c *TrelloClient) ListAllBoards() ([]TrelloBoard, error) {
	var boards []TrelloBoard
	err := c.request(http.MethodGet, "/members/me/boards", map[string]string{
		"fields": "id,name,url,closed",
	}, &boards)

	return boards, err
}

func (c *TrelloClient) ListBoards() ([]TrelloBoard, error) {
	boards, err := c.ListAllBoards()
	if err != nil {
		return nil, err
	}

	allowed := make([]TrelloBoard, 0, len(boards))

	for _, b := range boards {
		if contains(c.cfg.AllowedBoardIDs, b.ID) {
			allowed = append(allowed, b)
		}
	}

	return allowed, nil
}

func (c *TrelloClient) GetBoard(boardID string) (*TrelloBoard, error) {
	var board TrelloBoard
	err := c.request(http.MethodGet, "/boards/"+boardID, map[string]string{
		"fields": "id,name,url,closed",
	}, &board)

	return &board, err
}

func (c *TrelloClient) ListLists(boardID string) ([]TrelloList, error) {
	var lists []TrelloList
	err := c.request(http.MethodGet, "/boards/"+boardID+"/lists", map[string]string{
		"fields": "id,name,closed,idBoard",
	}, &lists)

	return lists, err
}

func (c *TrelloClient) ListCards(boardID string, listID *string) ([]TrelloCard, error) {
	path := "/boards/" + boardID + "/cards"

	if listID != nil && *listID != "" {
		path = "/lists/" + *listID + "/cards"
	}

	var cards []TrelloCard
	err := c.request(http.MethodGet, path, map[string]string{
		"fields": "id,name,desc,url,closed,idBoard,idList,due,dueComplete,labels",
	}, &cards)

	return cards, err
}

func (c *TrelloClient) GetCard(cardID string) (*TrelloCard, error) {
	var card TrelloCard
	err := c.request(http.MethodGet, "/cards/"+cardID, map[string]string{
		"fields": "id,name,desc,url,closed,idBoard,idList,due,dueComplete,labels",
	}, &card)

	return &card, err
}

func (c *TrelloClient) ListAttachments(cardID string) ([]TrelloAttachment, error) {
	var attachments []TrelloAttachment
	err := c.request(http.MethodGet, "/cards/"+cardID+"/attachments", map[string]string{
		"fields": "id,name,url,mimeType,bytes,date,isUpload",
	}, &attachments)

	return attachments, err
}

func (c *TrelloClient) GetCardWithAttachments(cardID string) (*CardWithAttachments, error) {
	card, err := c.GetCard(cardID)
	if err != nil {
		return nil, err
	}

	attachments, err := c.ListAttachments(cardID)
	if err != nil {
		return nil, err
	}

	return &CardWithAttachments{TrelloCard: *card, Attachments: attachments}, nil
}

func (c *TrelloClient) CreateCard(input CreateCardInput) (*TrelloCard, error) {
	query := map[string]string{
		"idList": input.IDList,
		"name":   input.Name,
	}

	if input.Desc != nil {
		query["desc"] = *input.Desc
	}

	if input.Due != nil {
		query["due"] = *input.Due
	}

	if len(input.IDLabels) > 0 {
		query["idLabels"] = strings.Join(input.IDLabels, ",")
	}

	var card TrelloCard
	err := c.request(http.MethodPost, "/cards", query, &card)

	return &card, err
}

func (c *TrelloClient) UpdateCard(cardID string, input UpdateCardInput) (*TrelloCard, error) {
	query := map[string]string{}

	if input.Name != nil {
		query["name"] = *input.Name
	}

	if input.Desc != nil {
		query["desc"] = *input.Desc
	}

	if input.Due != nil {
		query["due"] = *input.Due
	}

	if input.DueComplete != nil {
		query["dueComplete"] = boolStr(*input.DueComplete)
	}

	if input.Closed != nil {
		query["closed"] = boolStr(*input.Closed)
	}

	if input.IDLabels != nil {
		query["idLabels"] = strings.Join(input.IDLabels, ",")
	}

	var card TrelloCard
	err := c.request(http.MethodPut, "/cards/"+cardID, query, &card)

	return &card, err
}

func (c *TrelloClient) MoveCard(cardID, idList string) (*TrelloCard, error) {
	var card TrelloCard
	err := c.request(http.MethodPut, "/cards/"+cardID, map[string]string{"idList": idList}, &card)

	return &card, err
}

func (c *TrelloClient) AddComment(cardID, text string) (map[string]any, error) {
	var out map[string]any
	err := c.request(http.MethodPost, "/cards/"+cardID+"/actions/comments", map[string]string{
		"text": text,
	}, &out)

	return out, err
}

func (c *TrelloClient) ArchiveCard(cardID string) (*TrelloCard, error) {
	closed := true

	return c.UpdateCard(cardID, UpdateCardInput{Closed: &closed})
}

func (c *TrelloClient) AddAttachment(input AddAttachmentInput) (*TrelloAttachment, error) {
	if input.URL != nil && *input.URL != "" {
		query := map[string]string{"url": *input.URL}

		if input.Name != nil {
			query["name"] = *input.Name
		}

		if input.SetCover != nil {
			query["setCover"] = boolStr(*input.SetCover)
		}

		var attachment TrelloAttachment
		err := c.request(http.MethodPost, "/cards/"+input.CardID+"/attachments", query, &attachment)

		return &attachment, err
	}

	if input.FilePath != nil && *input.FilePath != "" {
		return c.uploadAttachmentFile(input)
	}

	return nil, &TrelloMcpError{Message: "Either url or file_path is required"}
}

func (c *TrelloClient) uploadAttachmentFile(input AddAttachmentInput) (*TrelloAttachment, error) {
	filePath := *input.FilePath

	fileName := filepath.Base(filePath)
	if input.Name != nil && *input.Name != "" {
		fileName = *input.Name
	}

	fileBuffer, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	mimeType := "application/octet-stream"
	if input.MimeType != nil && *input.MimeType != "" {
		mimeType = *input.MimeType
	}

	u, err := url.Parse(trelloAPIBase + "/cards/" + input.CardID + "/attachments")
	if err != nil {
		return nil, err
	}

	q := u.Query()
	q.Set("key", c.cfg.APIKey)
	q.Set("token", c.cfg.Token)

	if input.Name != nil && *input.Name != "" {
		q.Set("name", *input.Name)
	}

	if input.SetCover != nil {
		q.Set("setCover", boolStr(*input.SetCover))
	}

	u.RawQuery = q.Encode()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename=%q`, fileName))
	header.Set("Content-Type", mimeType)

	part, err := writer.CreatePart(header)
	if err != nil {
		return nil, err
	}

	if _, err := part.Write(fileBuffer); err != nil {
		return nil, err
	}

	if err := writer.Close(); err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, u.String(), body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &TrelloAPIError{Status: resp.StatusCode, Message: safeErrorMessage(resp)}
	}

	var attachment TrelloAttachment
	if err := json.NewDecoder(resp.Body).Decode(&attachment); err != nil {
		return nil, err
	}

	return &attachment, nil
}

func (c *TrelloClient) request(method, path string, query map[string]string, out any) error {
	u, err := url.Parse(trelloAPIBase + path)
	if err != nil {
		return err
	}

	q := u.Query()
	q.Set("key", c.cfg.APIKey)
	q.Set("token", c.cfg.Token)

	for k, v := range query {
		q.Set(k, v)
	}

	u.RawQuery = q.Encode()

	req, err := http.NewRequest(method, u.String(), nil)
	if err != nil {
		return err
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}

	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &TrelloAPIError{Status: resp.StatusCode, Message: safeErrorMessage(resp)}
	}

	if out == nil {
		return nil
	}

	return json.NewDecoder(resp.Body).Decode(out)
}

func safeErrorMessage(resp *http.Response) string {
	raw, err := io.ReadAll(resp.Body)
	if err != nil || len(raw) == 0 {
		return resp.Status
	}

	var payload struct {
		Message string `json:"message"`
		Error   string `json:"error"`
	}

	if err := json.Unmarshal(raw, &payload); err == nil {
		if payload.Message != "" {
			return payload.Message
		}

		if payload.Error != "" {
			return payload.Error
		}
	}

	text := strings.TrimSpace(string(raw))
	if text != "" {
		return text
	}

	return resp.Status
}

func boolStr(v bool) string {
	if v {
		return "true"
	}

	return "false"
}

func contains(list []string, value string) bool {
	for _, item := range list {
		if item == value {
			return true
		}
	}

	return false
}
