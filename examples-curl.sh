#!/usr/bin/env bash

BASE_URL="http://localhost:8080"

curl -X POST "$BASE_URL/api/contacts" \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Ana","email":"ana@email.com","consentimento":true,"inscritoLives":true}'

curl "$BASE_URL/api/contacts"


curl -X POST "$BASE_URL/api/contacts/import-lines" \
  -H 'Content-Type: text/plain' \
  --data-binary $'maria@email.com\njoao@email.com\nEmailInvalido\n'

curl -X POST "$BASE_URL/api/campaigns" \
  -H 'Content-Type: application/json' \
  -d '{"titulo":"Live Java 21","assunto":"Nova live hoje!","conteudoHtml":"<h1>Participe</h1>"}'

curl -X POST "$BASE_URL/api/campaigns/1/schedule" \
  -H 'Content-Type: application/json' \
  -d '{"scheduledAt":"2026-01-10T18:30:00Z"}'

curl -X POST "$BASE_URL/api/campaigns/1/send-now"

curl "$BASE_URL/api/campaigns/1/status"

curl "$BASE_URL/api/unsubscribe/TOKEN_AQUI"
