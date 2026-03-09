# 🎬 Oscar Watchlist v6

Uma aplicação web completa (Node.js + React) para acompanhar, votar e visualizar os indicados e vencedores do Oscar. Suporte a **múltiplas edições** — basta criar uma nova pasta de dados para cada ano.

## 🚀 Funcionalidades

- **Múltiplos Perfis**: Crie seu perfil e concorra com amigos.
- **Palpites**: Faça suas apostas por categoria e salve automaticamente.
- **Capas Automáticas**: Download automático de pôsteres em background (integração com TMDB, OMDB, Wikidata ou Wikipedia).
- **Multi-Edição**: Suporte a várias edições do Oscar (2026, 2027…) com dados isolados por edição.
- **Interface Moderna**: Construída com React para uma experiência rápida e fluida.

## 🛠️ Tecnologias

- **Backend**: Node.js, Express
- **Frontend**: React (Vite + TailwindCSS)
- **Armazenamento**: JSON files (em `data/editions/<ano>/`)

## ⚙️ Instalação e Execução

Pré-requisitos: Node.js instalado.

```bash
# 1. Instalar dependências e fazer o build do React
npm run setup

# 2. Iniciar o servidor
npm start
# → http://localhost:3000
```

## 🖼️ Baixar capas dos filmes

O servidor tenta baixar as capas automaticamente na inicialização. Para forçar o download manualmente:

```bash
# Com Wikipedia (gratuito, sem chave)
npm run posters

# Com TMDB (melhor qualidade — chave gratuita em themoviedb.org/settings/api)
TMDB_API_KEY=sua_chave npm run posters
```
Ou adicione as chaves em um arquivo `.env` na raiz do projeto:
```env
TMDB_API_KEY=sua_chave
OMDB_API_KEY=sua_chave
```

## 📅 Criar nova edição do Oscar

```bash
# Criar edição vazia
npm run new-edition -- 2027

# Criar a partir de uma edição existente
npm run new-edition -- 2027 --from 2026
```

Após criar, edite os arquivos em `data/editions/2027/` com os novos indicados e defina `"current": true` no `data/editions.json`.

## 📂 Estrutura de Dados

```
data/
├── editions.json          # Lista de edições disponíveis
├── editions/
│   ├── 2026/
│   │   ├── films.json     # Filmes indicados
│   │   ├── categories.json # Categorias e indicados
│   │   └── state.json     # Perfis, palpites, resultados
│   └── 2027/              # Futuras edições...
└── db.js                  # Módulo de acesso a dados
```

## 🧪 Testes

```bash
npm test
```

## 📜 Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm start` | Inicia o servidor na porta 3000 |
| `npm run dev:server` | Executa o backend |
| `npm run dev:client` | Executa o frontend React localmente |
| `npm run setup` | Instala dependências root/client e realiza o build |
| `npm run build` | Compila o React para produção (na pasta `client/dist`) |
| `npm run posters` | Baixa capas faltantes |
| `npm run posters:force` | Rebaixa todas as capas |
| `npm run new-edition -- <ano>` | Cria estrutura para nova edição |
| `npm test` | Executa os testes automatizados |
