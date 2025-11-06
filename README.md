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

## 🚀 Como Usar

### Localmente

1. Clone ou faça download deste repositório
2. Abra o ficheiro `index.html` num navegador web
3. Use a password padrão: `meuinventario123` (pode alterar no ficheiro `config.js`)

### Alterar a Password

1. Abra o ficheiro `config.js`
2. Altere o valor da propriedade `PASSWORD`:
```javascript
const CONFIG = {
    PASSWORD: 'a_sua_nova_password'
};
```

## 🌐 Deploy no GitHub Pages

### Passo 1: Criar Repositório

1. Crie um novo repositório no GitHub
2. Faça upload de todos os ficheiros:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `config.js`
   - `README.md`

### Passo 2: Ativar GitHub Pages

1. Vá às **Settings** do repositório
2. No menu lateral, clique em **Pages**
3. Em **Source**, selecione a branch `main` (ou `master`)
4. Clique em **Save**
5. Aguarde alguns minutos e aceda ao URL fornecido

A sua aplicação estará disponível em: `https://<seu-usuario>.github.io/<nome-do-repositorio>/`

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
├── index.html      # Estrutura HTML principal
├── styles.css      # Estilos e design responsivo
├── app.js          # Lógica da aplicação
├── config.js       # Configurações (password)
└── README.md       # Este ficheiro
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
- **localStorage** - Armazenamento de dados

## 📄 Licença

Este projeto é de uso livre. Sinta-se à vontade para modificar e adaptar às suas necessidades.

## 🤝 Contribuições

Sugestões e melhorias são bem-vindas!

---

**Desenvolvido com ❤️ para facilitar a gestão do seu inventário pessoal**
