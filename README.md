# 👑 REI RUN — ESPECIFICAÇÃO TÉCNICA E CONCEITUAL DEFINITIVA
### O Jogo Oficial do Rei Zero — Criado por HAMILTON DAVID NIHEFE MUENDA - O ZERO
**Frase Oficial:** *"CORRE REI. DESVIA. COROA É DE QUEM MERECE."*

---

## 1. CONCEITO GERAL E FILOSOFIA (100% HABILIDADE)
- **Dinâmica Competitiva:** Um jogo Skill-Betting Runner Multiplayer em tempo real para 5 jogadores simultâneos.
- **Regra de Ouro:** Zero sorte, zero pay-to-win e sem vidas ou eliminações por dano. Os avatares não morrem; a vitória é decidida estritamente pela habilidade pura, reflexos rápidos nos desvios e por quem cruzar a meta primeiro.
- **Duração da Partida:** Exatamente 40 segundos por partida até o jogador alcançar o Trono Real na meta.
- **Modos e Personalização:**
  - Alternância fluida nas configurações entre **Modo 2D** e **Modo 3D (Three.js)**.
  - Alternância entre **Modo Dia** (Marginal ensolarada) e **Modo Noite** (Neon urbano de Luanda).
  - Suporte multilíngue selecionável no menu: **Português**, **Inglês**, **Umbundo**, **Kimbundo** e **Kikongo**.

---

## 2. GAMEPLAY, POSIÇÕES E CONTROLES
- **A Corrida:** 5 concorrentes correm cada um em sua faixa exclusiva na pista de **5 faixas (lanes)**. Os 3 primeiros que chegarem mais longe / cruzarem a meta ganham; os 2 últimos perdem.
- **Controles Mobile (Gestos Táteis):**
  - Deslizar Cima: Pular obstáculos baixos.
  - Deslizar Baixo: Agachar/desviar para passar sob estruturas.
  - Toque 2x: Dash (impulso de velocidade de alta performance).
  - Deslizar Laterais: Mudar de faixa.
- **Controles Desktop:**
  - Teclas `A` / `D` ou Setas `←` / `→` (Mudar de faixa).
  - Tecla `W` ou `Espaço` ou `↑` (Pular).
  - Tecla `S` ou `↓` (Agachar).
  - Tecla `Shift` (Dash).
- **Dificuldade Progressiva (Waves):**
  - 0 a 20 segundos: Ritmo Inicial (Fácil).
  - 20 a 40 segundos: Ritmo Urbano Intenso / **MODO REI DIFÍCIL**.

---

## 3. OS 10 AVATARES OFICIAIS (LOJA DO JOGO)
1. **REI ZERO** (Título exclusivo do criador - Avatar Principal Padrão)
2. **REI ZERO DOURADO**
3. **ZUNGUEIRA**
4. **KUDURISTA**
5. **CANDONGUEIRO**
6. **POLÍCIA**
7. **TAXISTA AZUL E BRANCO**
8. **MAMÃE LANCHEIRA**
9. **KOTAS DO DOMINO**
10. **JOVEM DA MARGINAL**

*Todos desbloqueáveis na loja do jogo.*

---

## 4. OBSTÁCULOS URBANOS E POWER-UPS (SEM VIDAS)
- **Obstáculos de Luanda:**
  1. Buracos na Marginal (pular)
  2. Zungueira com bacia (pular/desviar)
  3. Candongueiro parado (desviar/agachar)
  4. Tambor (pular/desviar)
  5. Polícia (desviar)
  6. Táxi Azul e Branco (desviar/agachar)
  7. Balde d'água (pular)
  8. Cão de rua (pular/desviar)
  9. Fios caídos (agachar)
  10. Montra (desviar)
  *(Colidir com um obstáculo apenas retarda o corredor momentaneamente na pista, testando a sua destreza, sem o conceito de "morrer").*
- **Power-Ups de Habilidade:**
  - **Kikuuba Nitro:** Velocidade máxima temporária por 3s.
  - **Chapéu do Kudurista:** Imunidade a abrandamentos por 3s.
  - **Gasosa:** Pequeno impulso de aceleração na pista.

---

## 5. IDENTIDADE, MARCA E LOBBY ("TRONO DO REI")
- **Autoria Exclusiva:** Assinatura visível de **HAMILTON DAVID NIHEFE MUENDA - O ZERO** nas telas de carregamento (Loading), no Lobby e nos painéis administrativos.
- **Lobby e Salas:** Exibição do avatar do Jogador Top 1 da semana sentado no trono com a coroa. Gestão de salas públicas e privadas, com a fixa "**Sala do REI ZERO**" no topo.
- **Efeitos Visuais:** Celebração de vitória com coroação, confetes tricolores (vermelho, amarelo, preto / verde) e batida de kizomba/kuduro.

---

## 6. MONETIZAÇÃO (AS 3 TORNEIRAS DO REI) & FINANCEIRO GLOBAL
- **Banca e Distribuição:**
  - Ex: 5 jogadores × 500 KZ = 2.500 KZ de banca total.
  - **70% para os Vencedores** (**50%** do pote total para o **1º Lugar** e **20%** para o **2º Lugar**, mesmo no Modo Real)
  - **20% para a CASA**
  - **10% de Royalties para o CRIADOR REI ZERO**
- **Loja e Passe do Rei:**
  - Venda de Skins (5% para o Criador)
  - Passe do Rei (5.000 KZ/mês com 5% de royalties para o Criador).
- **Financeiro Global:** Sistema de conversão automática de moedas (Kz, R$, EUR, USD, etc.).

---

## 7. PAINEL DO CRIADOR — DASHBOARD DO REI ZERO
- **Acesso Restrito:** Rota `/admin-rei-zero` protegida por autenticação criptográfica exclusiva para Hamilton David Nihefe Muenda (credenciais ocultas por segurança).
- **Métricas em Tempo Real:** Partidas jogadas (Hoje/Ontem/Mês), GGR Total em USD, Royalties acumulados (10% GGR + 5% Skins + 5% Passe), relatórios de vendas, estatísticas de mapas/modos (2D vs 3D | Dia vs Noite), top jogadores e exportação em CSV/PDF.
- **Rodapé Legal Obrigatório:**
  `"PROPRIEDADE INTELECTUAL DE HAMILTON DAVID NIHEFE MUENDA - O ZERO | ROYALTIES: 10% GGR | ESCALONAMENTO: 15% ACIMA DE 10.000 PARTIDAS/DIA | 20% ACIMA DE 50.000 PARTIDAS/DIA | REVISÃO 12 MESES"`

---

## 8. ARQUITETURA TÉCNICA E EXECUÇÃO
- **Stack Tecnológica:** Frontend em React 19 + Canvas 2D + Three.js (Modo 3D) + Web Audio API.
- **Preenchimento por Bots:** Inclusão automática de corredores virtuais com nomes angolanos (`Kota Banza`, `Zito Kuduro`, `Tia Maria Zunga`, `Beto Candonga`, etc.) caso a sala não feche 5 jogadores em 10 segundos.
- **Anti-Cheat e Pagamentos:** Validação de colisões processada com continuous collision detection e estrutura pronta para Multicaixa Express, Unitel Money e PayPal.
