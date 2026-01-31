# 📦 Inventário Pessoal

Uma aplicação web simples e responsiva para gerir o seu inventário pessoal de ferramentas, materiais elétricos, componentes eletrônicos, placas Arduino e muito mais.

## ✨ Funcionalidades

- 🔐 **Login com password** - Proteja o seu inventário com uma password
- ➕ **Adicionar itens** - Adicione novos itens ao inventário
- ✏️ **Editar itens** - Edite informações de itens existentes
- 🗑️ **Eliminar itens** - Remova itens do inventário
- 📊 **Controlo de stock** - Aumente ou diminua quantidades facilmente
- ⚠️ **Alertas de stock baixo** - Notificações visuais quando o stock está baixo
- 🏷️ **Categorias** - Organize por: Ferramentas, Material Elétrico, Componentes Eletrônicos, Placas e Arduinos, Ferragens, Outros
- 🔍 **Busca** - Encontre itens rapidamente por nome, localização ou notas
- 📱 **Design responsivo** - Funciona perfeitamente em desktop, tablet e mobile
- 💾 **Armazenamento local** - Dados salvos no navegador (localStorage)
- ☁️ **Sincronização automática** - Backup e sync com GitHub Gist
- 📤 **Export/Import JSON** - Backup manual também disponível

## 🚀 Como Usar

### Localmente

1. Clone ou faça download deste repositório
2. **IMPORTANTE**: Copie o ficheiro `config.example.js` para `config.js`:
   ```bash
   cp config.example.js config.js
   ```
3. Edite `config.js` e defina a sua password
4. Abra o ficheiro `index.html` num navegador web

### Configurar a Password e GitHub Token

1. Copie `config.example.js` para `config.js` (se ainda não o fez)
2. Abra o ficheiro `config.js`
3. Altere o valor da propriedade `PASSWORD`:
```javascript
const CONFIG = {
    PASSWORD: 'a_sua_password_secreta',
    GITHUB_TOKEN: 'seu_token_github_aqui',  // Obtenha em https://github.com/settings/tokens
    GIST_ID: ''  // Deixar vazio, será criado automaticamente
};
```

**Nota**: O ficheiro `config.js` está no `.gitignore` para não expor a sua password no repositório público.

### Como Obter o GitHub Token (para sincronização)

A sincronização automática usa GitHub Gist para backup na cloud. Para configurar:

1. Aceda a: https://github.com/settings/tokens
2. Clique em **"Generate new token (classic)"**
3. Dê um nome: `Inventário Pessoal`
4. Marque apenas a permissão **`gist`**
5. Clique em **"Generate token"**
6. **Copie o token** (começa com `ghp_...`)
7. Cole no `config.js` em `GITHUB_TOKEN`

⚠️ **Importante**: Guarde o token em local seguro. Não o partilhe nem comite no git!

## 🌐 Deploy no GitHub Pages

### Passo 1: Criar Repositório

1. Crie um novo repositório no GitHub
2. **IMPORTANTE**: Antes de fazer upload, configure a sua password:
   - Copie `config.example.js` para `config.js`
   - Edite `config.js` com a sua password
3. Faça upload de todos os ficheiros (o `config.js` não será incluído devido ao `.gitignore`):
   - `index.html`
   - `styles.css`
   - `app.js`
   - `config.example.js`
   - `.gitignore`
   - `README.md`

### Passo 2: Ativar GitHub Pages

1. Vá às **Settings** do repositório
2. No menu lateral, clique em **Pages**
3. Em **Source**, selecione a branch `main` (ou `master`)
4. Clique em **Save**
5. **IMPORTANTE**: Crie o ficheiro `config.js` no GitHub:
   - Vá para o repositório
   - Clique em "Add file" → "Create new file"
   - Nome do ficheiro: `config.js`
   - Conteúdo:
     ```javascript
     const CONFIG = {
         PASSWORD: 'a_sua_password_aqui'
     };
     ```
   - Commit do ficheiro
6. Aguarde alguns minutos e aceda ao URL fornecido

A sua aplicação estará disponível em: `https://<seu-usuario>.github.io/<nome-do-repositorio>/`

**💡 Dica**: Não se esqueça de fazer backups regulares usando a função "Exportar JSON"!

## 📱 Uso em Mobile/Android

A aplicação está otimizada para uso em dispositivos móveis:

- **Interface touch-friendly** com botões grandes
- **Design responsivo** que se adapta ao tamanho da tela
- **Scroll suave** para navegação fácil
- **Formulários otimizados** para teclados móveis

### Dica: Adicionar ao Ecrã Inicial (Android)

1. Abra a aplicação no Chrome/Firefox
2. Toque no menu (⋮)
3. Selecione "Adicionar ao ecrã inicial"
4. A aplicação aparecerá como um ícone no seu dispositivo

## 📂 Estrutura de Ficheiros

```
inventario-pessoal/
├── index.html         # Estrutura HTML principal
├── styles.css         # Estilos e design responsivo
├── app.js             # Lógica da aplicação
├── service-worker.js  # Service worker para PWA
├── manifest.json      # Manifesto da PWA
├── config.js          # Configurações (password)
└── README.md          # Este ficheiro
```

## 💡 Dicas de Uso

### Gestão de Stock

- Use os botões **−** e **+** para ajustar rapidamente as quantidades
- Defina um **Stock Mínimo** para receber alertas visuais
- Items com stock baixo aparecem com badge amarelo
- Items sem stock aparecem com badge vermelho

### Organização

- Use o campo **Localização** para registar onde guarda cada item (ex: "Gaveta 3", "Caixa A")
- Use **Notas** para informações adicionais (ex: especificações técnicas, data de compra)
- Filtre por **Categoria** para ver apenas tipos específicos de items

### Backup e Restauro

- **Exportar Dados**: Clique em "📦 Exportar JSON" para fazer download de todos os seus dados num ficheiro JSON
- **Importar Dados**: Clique em "📂 Importar JSON" para restaurar dados de um backup anterior
- **Recomendação**: Faça backups regulares dos seus dados, especialmente antes de grandes alterações

### Busca

- A busca procura em: nome do item, localização e notas
- Combine busca com filtro de categoria para resultados mais específicos

## 🔒 Segurança

⚠️ **IMPORTANTE**: Esta aplicação usa uma password hardcoded no ficheiro `config.js`. Isto significa que:

- Qualquer pessoa com acesso ao código-fonte pode ver a password
- Esta solução é adequada para uso pessoal e privado
- **NÃO use esta aplicação para dados sensíveis ou comerciais**
- Se o repositório for público, todos podem ver a password

Para maior segurança:
- Mantenha o repositório privado
- Ou use apenas localmente
- Considere implementar autenticação backend para uso profissional

## 🛠️ Tecnologias Utilizadas

- **HTML5** - Estrutura
- **CSS3** - Design e responsividade
- **JavaScript (ES6+)** - Lógica da aplicação
- **localStorage** - Armazenamento de dados local
- **Service Worker** - Funcionalidade offline (PWA)

## � Backup e Sincronização

Esta aplicação armazena todos os dados **localmente no seu navegador** (localStorage). Isto significa:

✅ **Vantagens:**
- Funciona 100% offline
- Dados completamente privados
- Sem custos de servidor
- Sem problemas de pausas ou timeouts

⚠️ **Importante:**
- Os dados ficam apenas no navegador onde foram criados
- Se limpar os dados do navegador, perderá o inventário
- Não sincroniza automaticamente entre dispositivos

🔄 **Para usar em múltiplos dispositivos:**
1. No dispositivo A: Clique em "📦 Exportar JSON" e guarde o ficheiro
2. Envie o ficheiro para o dispositivo B (email, cloud, USB, etc.)
3. No dispositivo B: Clique em "📂 Importar JSON" e selecione o ficheiro

💡 **Recomendação:** Faça backups regulares exportando os dados em JSON, especialmente:
- Antes de trocar de navegador
- Antes de limpar dados do navegador
- Após adicionar muitos itens novos
- Semanalmente (como precaução)

## �📄 Licença

Este projeto é de uso livre. Sinta-se à vontade para modificar e adaptar às suas necessidades.

## 🤝 Contribuições

Sugestões e melhorias são bem-vindas!

---

**Desenvolvido com ❤️ para facilitar a gestão do seu inventário pessoal**
