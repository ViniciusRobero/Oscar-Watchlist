# 🎬 Oscar Watchlist v6

Uma aplicação web completa (Node.js + React) para acompanhar, votar e visualizar os indicados e vencedores do Oscar.

## 🚀 Funcionalidades

- **Múltiplos Perfis**: Crie seu perfil e concorra com amigos.
- **Palpites**: Faça suas apostas por categoria e salve automaticamente.
- **Capas Automáticas**: Download automático de pôsteres em background (integração com TMDB, OMDB, Wikidata ou Wikipedia).
- **Interface Moderna**: Construída com React para uma experiência rápida e fluida.

## 🛠️ Tecnologias

- **Backend**: Node.js, Express
- **Frontend**: React
- **Armazenamento**: JSON files (em `/data`)

## ⚙️ Instalação e Execução

Pré-requisitos: Node.js instalado.

```bash
# 1. Instalar dependências (do servidor e cliente) e fazer o build do React
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

Após baixar as capas, reinicie o servidor (`npm start`) para que os filmes atualizem.

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
