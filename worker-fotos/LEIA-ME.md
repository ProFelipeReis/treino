# Fotos no Cloudflare R2 (grátis até 10 GB)

As fotos de gestores e alunos ficam no **R2**. No Firestore (coleções `managers` e `students`)
fica só o endereço da foto (`photoURL`) e a chave dela (`photoKey`). Quem pode enviar/apagar
é decidido pelo **login do Firebase**: o Worker confere o token de cada pedido.

Plano grátis do R2: 10 GB, 1 milhão de gravações e 10 milhões de leituras por mês, tráfego de saída grátis.
O site reduz cada foto para 320×320 (cerca de 30 KB), então 10 GB comportam centenas de milhares de fotos.

## Publicar (uma vez só)

1. No painel da Cloudflare, abra **R2 Object Storage** e ative o R2 (pede cartão, mas não cobra dentro do limite grátis).
2. No computador, dentro da pasta `worker-fotos`:

       npx wrangler login
       npx wrangler r2 bucket create trainly-fotos
       npx wrangler deploy

3. O último comando mostra o endereço do Worker, algo como `https://trainly-fotos.SEUNOME.workers.dev`.
   Cole esse endereço (sem barra no final) em **`fotos-config.js`** na raiz do site:

       window.TRAINLY_PHOTO_API = "https://trainly-fotos.SEUNOME.workers.dev";

4. Publique o site de novo (commit/push no GitHub).

Enquanto `fotos-config.js` estiver vazio, tudo funciona como antes (foto dentro do Firestore).

## Como funciona

| Quem | Onde troca a foto | O que é salvo no Firestore |
|---|---|---|
| Gestor | Perfil (`app.html`) e cadastro (`cadastro.html`) | `managers/{id}`: `photoURL`, `photoKey` |
| Aluno | Perfil (`aluno.html`) | `students/{id}`: `photoURL`, `photoKey` |

- Cada envio gera um nome novo e imprevisível, então ninguém sobrescreve a foto de outra pessoa.
- Ao trocar ou remover a foto, a antiga é apagada do R2 (só quem a enviou consegue apagar).
- Cada foto no R2 guarda o `uid` do Firebase de quem enviou, o tipo e o ID do documento.
- Fotos antigas (salvas dentro do Firestore) continuam aparecendo; migram para o R2 quando a pessoa trocar a foto.

## Se você usa regras restritivas no Firestore

O site passa a gravar o campo novo `photoKey` em `managers` e `students`. Se suas regras
listam os campos permitidos, inclua `photoKey` ao lado de `photoURL`.
