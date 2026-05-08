# CrossFit Leaderboard (monolito Django + React)

Plataforma para competições de CrossFit: API REST em **Django 5** + **DRF** + **JWT**, frontend **React 18** (Vite) + **TailwindCSS**, banco **PostgreSQL** (recomendado [Neon](https://neon.tech)).

## Estrutura

- `backend/` — projeto Django (`config/`, apps em `apps/`)
- `frontend/` — SPA React; em produção o build fica em `frontend/dist/` e arquivos estáticos são servidos em `/static/` pelo Django (WhiteNoise)
- `.env` na raiz (veja `.env.example`)

## Requisitos

- Python 3.12+ (3.10+ costuma funcionar)
- Node.js 20+
- Conta Neon ou outro Postgres (opcional em dev: deixe `DATABASE_URL` vazio para SQLite)

## Setup local

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

Crie `.env` na **raiz** do repositório (copie de `.env.example`). Para Neon:

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST/neondb?sslmode=require
```

```bash
python manage.py migrate
# usuário admin (interativo) ou, no Windows PowerShell:
# $env:DJANGO_SUPERUSER_PASSWORD="sua_senha_segura"
# python manage.py createsuperuser --noinput --username admin --email admin@example.com
python manage.py createsuperuser
python manage.py seed_demo
python manage.py runserver
```

- API: `http://127.0.0.1:8000/api/`
- Django Admin: `http://127.0.0.1:8000/django-admin/`

### 2. Frontend (desenvolvimento)

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

O Vite usa proxy para `/api` e `/media` em `http://127.0.0.1:8000`.

**Login admin (API JWT):** `POST /api/auth/token/` com usuário staff criado pelo `createsuperuser`.

### 3. Monolito (API + UI no mesmo host)

```bash
cd frontend && npm run build
cd ../backend && python manage.py collectstatic --noinput
gunicorn config.wsgi:application --bind 0.0.0.0:8000
```

Abra `http://127.0.0.1:8000/` — rotas do React; `/api/...` continuam como REST.

## Endpoints públicos (sem autenticação)

| Método | Caminho |
|--------|---------|
| GET | `/api/public/competition/info/` |
| GET | `/api/public/events/schedule/` |
| GET | `/api/public/events/<id>/results/` |
| GET | `/api/public/leaderboard/?category=Rx` (categorias: Rx, Scaled, Masters, Team) |
| GET | `/api/public/athletes/<id>/profile/` |

## Regras implementadas

- Resultado só em prova compatível com a categoria do atleta (ou time em provas `Team`).
- Ao salvar ou excluir `Result`, sinais recalculam posições e pontos da prova (cascata).
- Heat não pode ir para `in_progress` se um heat **anterior** (mesma prova) ainda está `in_progress`.
- Desempate no leaderboard geral: total de pontos → vitórias (1º) → melhor posição no último WOD (por `display_order`) → tie-break.

## Comando de seed

```bash
python manage.py seed_demo
```

## Deploy Heroku

O repositório é um monorepo (`backend/` + `frontend/`). É preciso **dois buildpacks** (Node antes, Python por último) e variáveis de ambiente.

### 1. Buildpacks (ordem importa)

No terminal (com [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)):

```bash
heroku buildpacks:clear -a NOME_DO_APP
heroku buildpacks:add heroku/nodejs -a NOME_DO_APP
heroku buildpacks:add heroku/python -a NOME_DO_APP
```

Na dashboard: **Settings → Buildpacks** — adicione **Node.js** em cima e **Python** embaixo.

### 2. Banco de dados

Anexe o Postgres da Heroku ou use Neon:

```bash
heroku addons:create heroku-postgresql:essential-0 -a NOME_DO_APP
```

(Isso define `DATABASE_URL` automaticamente.)

### 3. Variáveis de ambiente

```bash
heroku config:set DEBUG=False -a NOME_DO_APP
heroku config:set SECRET_KEY="uma-chave-longa-aleatoria" -a NOME_DO_APP
heroku config:set ALLOWED_HOSTS=".herokuapp.com,NOME_DO_APP.herokuapp.com" -a NOME_DO_APP
heroku config:set CSRF_TRUSTED_ORIGINS="https://NOME_DO_APP.herokuapp.com" -a NOME_DO_APP
```

Ajuste `CORS_ALLOWED_ORIGINS` se o front for servido de outro domínio (no monolito, a SPA vem do mesmo host — costuma bastar o mesmo URL em CSRF).

### 4. Deploy

Conecte o GitHub e faça deploy da branch `main`, ou:

```bash
git push heroku main
```

O **Node** roda `heroku-postbuild` (build do Vite em `frontend/dist/`). O **Python** instala deps pela `requirements.txt` na raiz. O **`release`** do `Procfile` aplica migrações e `collectstatic`.

### 5. Usuário admin (uma vez)

```bash
heroku run "cd backend && python manage.py createsuperuser" -a NOME_DO_APP
```

### Arquivos na raiz usados pela Heroku

| Arquivo | Função |
|--------|--------|
| `package.json` | Buildpack Node; script `heroku-postbuild` gera o frontend |
| `requirements.txt` | Aponta para `backend/requirements.txt` |
| `runtime.txt` | Versão do Python |
| `Procfile` | `release` (migrate + collectstatic) e `web` (Gunicorn) |

## Usuário admin

Crie com `createsuperuser`. O frontend admin (`/admin/login`) usa JWT em `/api/auth/token/`.