import { SupportedLanguage } from '../types/game';

export interface MultiplayerStrings {
  waitingOpponentSelecting: string;
  waitingOpponentNamesPrefix: string;
  selectingProfileBadge: string;
  readyBadge: string;
  hostBadge: string;
  onlineHumanBadge: string;
  hostControlsBetNote: string;
  waitingHostToStartBtn: string;
  hostWaitingOnYouBanner: string;
  roomConnectedLive: string;
  syncingPodiumNote: string;
  youBetLabel: string;
  youWonLabel: string;
  netResultLabel: string;
  stakePerRunnerShort: string;
  wonShort: string;
  breakdownTitle: string;
  colRunner: string;
  colDistance: string;
  colBet: string;
  colWon: string;
  hostStartedRaceToast: string;
  onlyHostCanStart: string;
  onlyLeaderControlsRoom: string;
  leaveRoomBtn: string;
  leftRoomNotice: string;
  manualBetPlaceholder: string;
  betRangeHint: string;
  liveRunnersBarTitle: string;
  normalMatchLiveBadge: string;
  actionRunning: string;
  actionJumping: string;
  actionSliding: string;
  actionDashing: string;
  actionStumbling: string;
  roomBetInlineLabel: string;
}

const PT_STRINGS: MultiplayerStrings = {
  waitingOpponentSelecting:
    'Espere os integrantes da sala terminarem de editar/configurar... A partida iniciará sincronizada assim que todos estiverem prontos!',
  waitingOpponentNamesPrefix: 'A aguardar:',
  selectingProfileBadge: 'A editar/configurar...',
  readyBadge: 'Pronto',
  hostBadge: 'LÍDER',
  onlineHumanBadge: 'ONLINE',
  hostControlsBetNote: 'Aposta sincronizada em tempo real pelo líder da sala',
  waitingHostToStartBtn: 'Aguardar Líder Iniciar...',
  hostWaitingOnYouBanner:
    'O líder da sala já clicou em começar! Finaliza o que estás a editar agora para a corrida arrancar já!',
  roomConnectedLive: 'Sala ligada em tempo real',
  syncingPodiumNote: 'A sincronizar classificação e prémios oficiais da sala...',
  youBetLabel: 'Apostaste',
  youWonLabel: 'Ganhaste',
  netResultLabel: 'Saldo Líquido',
  stakePerRunnerShort: 'Aposta',
  wonShort: 'Ganhou',
  breakdownTitle: 'Apostas e Ganhos de Cada Corredor',
  colRunner: 'Corredor',
  colDistance: 'Dist.',
  colBet: 'Apostou',
  colWon: 'Ganhou',
  hostStartedRaceToast: 'O líder iniciou a corrida! A sincronizar largada...',
  onlyHostCanStart: 'Apenas o líder que criou a sala pode iniciar a partida!',
  onlyLeaderControlsRoom: 'Apenas o líder da sala gere jogadores, aposta e início',
  leaveRoomBtn: 'Sair da Sala',
  leftRoomNotice: 'Saíste da sala e voltaste ao teu Lobby.',
  manualBetPlaceholder: 'Digita valor',
  betRangeHint: 'Intervalo válido:',
  liveRunnersBarTitle: 'Corredores & Apostas ao Vivo',
  normalMatchLiveBadge: 'Partida ao Vivo',
  actionRunning: 'A correr',
  actionJumping: 'Saltou',
  actionSliding: 'Deslizou',
  actionDashing: 'Dash!',
  actionStumbling: 'Tropeçou',
  roomBetInlineLabel: 'Aposta da Sala:',
};

const EN_STRINGS: MultiplayerStrings = {
  waitingOpponentSelecting:
    'Wait for room members to finish editing/configuring... The match will launch synchronized once everyone is ready!',
  waitingOpponentNamesPrefix: 'Waiting for:',
  selectingProfileBadge: 'Editing/configuring...',
  readyBadge: 'Ready',
  hostBadge: 'LEADER',
  onlineHumanBadge: 'ONLINE',
  hostControlsBetNote: 'Stake synchronized in real time by the room leader',
  waitingHostToStartBtn: 'Waiting for Leader to Start...',
  hostWaitingOnYouBanner:
    'The room leader already clicked Start! Finish what you are editing now so the race starts together!',
  roomConnectedLive: 'Room connected in real time',
  syncingPodiumNote: 'Synchronizing official room standings & payouts...',
  youBetLabel: 'You Bet',
  youWonLabel: 'You Won',
  netResultLabel: 'Net Result',
  stakePerRunnerShort: 'Bet',
  wonShort: 'Won',
  breakdownTitle: 'Stakes & Payouts Breakdown',
  colRunner: 'Runner',
  colDistance: 'Dist.',
  colBet: 'Bet',
  colWon: 'Won',
  hostStartedRaceToast: 'The leader started the race! Syncing start...',
  onlyHostCanStart: 'Only the room creator / leader can start the match!',
  onlyLeaderControlsRoom: 'Only the room leader manages players, stakes, and match start',
  leaveRoomBtn: 'Leave Room',
  leftRoomNotice: 'You left the room and returned to your Lobby.',
  manualBetPlaceholder: 'Enter amount',
  betRangeHint: 'Valid range:',
  liveRunnersBarTitle: 'Live Runners & Bets',
  normalMatchLiveBadge: 'Live Match',
  actionRunning: 'Running',
  actionJumping: 'Jumped',
  actionSliding: 'Slid',
  actionDashing: 'Dash!',
  actionStumbling: 'Stumbled',
  roomBetInlineLabel: 'Room Bet:',
};

const ES_STRINGS: MultiplayerStrings = {
  waitingOpponentSelecting:
    'Espera a que los miembros de la sala terminen de editar/configurar... ¡La partida comenzará sincronizada cuando todos estén listos!',
  waitingOpponentNamesPrefix: 'Esperando a:',
  selectingProfileBadge: 'Editando/configurando...',
  readyBadge: 'Listo',
  hostBadge: 'LÍDER',
  onlineHumanBadge: 'EN LÍNEA',
  hostControlsBetNote: 'Apuesta sincronizada en tiempo real por el líder de la sala',
  waitingHostToStartBtn: 'Esperando al Líder...',
  hostWaitingOnYouBanner:
    '¡El líder ya pulsó Empezar! Termina lo que estás editando ahora para comenzar juntos!',
  roomConnectedLive: 'Sala conectada en tiempo real',
  syncingPodiumNote: 'Sincronizando clasificación y premios oficiales...',
  youBetLabel: 'Apostaste',
  youWonLabel: 'Ganaste',
  netResultLabel: 'Resultado Neto',
  stakePerRunnerShort: 'Apuesta',
  wonShort: 'Ganó',
  breakdownTitle: 'Apuestas y Ganancias por Corredor',
  colRunner: 'Corredor',
  colDistance: 'Dist.',
  colBet: 'Apostó',
  colWon: 'Ganó',
  hostStartedRaceToast: '¡El líder inició la carrera! Sincronizando salida...',
  onlyHostCanStart: '¡Solo el líder creador de la sala puede iniciar la partida!',
  onlyLeaderControlsRoom: 'Solo el líder gestiona jugadores, apuesta e inicio',
  leaveRoomBtn: 'Salir de la Sala',
  leftRoomNotice: 'Saliste de la sala y volviste a tu Lobby.',
  manualBetPlaceholder: 'Ingresa valor',
  betRangeHint: 'Rango válido:',
  liveRunnersBarTitle: 'Corredores y Apuestas en Vivo',
  normalMatchLiveBadge: 'Partida en Vivo',
  actionRunning: 'Corriendo',
  actionJumping: 'Saltó',
  actionSliding: 'Deslizó',
  actionDashing: '¡Dash!',
  actionStumbling: 'Tropezó',
  roomBetInlineLabel: 'Apuesta de Sala:',
};

const FR_STRINGS: MultiplayerStrings = {
  waitingOpponentSelecting:
    'Attendez que les membres terminent leurs modifications... La course démarrera en simultané dès que tout le monde sera prêt !',
  waitingOpponentNamesPrefix: 'En attente de :',
  selectingProfileBadge: 'En cours d’édition...',
  readyBadge: 'Prêt',
  hostBadge: 'CHEF',
  onlineHumanBadge: 'EN LIGNE',
  hostControlsBetNote: 'Mise synchronisée en temps réel par le chef de salle',
  waitingHostToStartBtn: 'En attente du chef...',
  hostWaitingOnYouBanner:
    'Le chef de salle a déjà lancé la partie ! Terminez votre édition pour démarrer ensemble !',
  roomConnectedLive: 'Salle connectée en temps réel',
  syncingPodiumNote: 'Synchronisation du classement et des gains officiels...',
  youBetLabel: 'Vous avez misé',
  youWonLabel: 'Vous avez gagné',
  netResultLabel: 'Résultat Net',
  stakePerRunnerShort: 'Mise',
  wonShort: 'Gain',
  breakdownTitle: 'Mises et Gains par Coureur',
  colRunner: 'Coureur',
  colDistance: 'Dist.',
  colBet: 'Misé',
  colWon: 'Gagné',
  hostStartedRaceToast: 'Le chef a lancé la course ! Synchronisation du départ...',
  onlyHostCanStart: 'Seul le créateur / chef de salle peut lancer la partie !',
  onlyLeaderControlsRoom: 'Seul le chef gère les joueurs, la mise et le départ',
  leaveRoomBtn: 'Quitter la Salle',
  leftRoomNotice: 'Vous avez quitté la salle et êtes revenu dans votre Lobby.',
  manualBetPlaceholder: 'Saisir montant',
  betRangeHint: 'Plage valide :',
  liveRunnersBarTitle: 'Coureurs & Mises en Direct',
  normalMatchLiveBadge: 'Match en Direct',
  actionRunning: 'En course',
  actionJumping: 'A sauté',
  actionSliding: 'A glissé',
  actionDashing: 'Dash !',
  actionStumbling: 'Trébuché',
  roomBetInlineLabel: 'Mise de la salle :',
};

export function getMultiplayerStrings(lang: SupportedLanguage): MultiplayerStrings {
  if (lang === 'pt' || lang === 'umb' || lang === 'kmb' || lang === 'kik') return PT_STRINGS;
  if (lang.startsWith('es')) return ES_STRINGS;
  if (lang === 'fr') return FR_STRINGS;
  return EN_STRINGS;
}
