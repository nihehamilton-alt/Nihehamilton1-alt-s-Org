import { calculateThreeTorneiras } from '../data/currency';
import { ThreeTorneirasSplit } from '../types/game';

export function calculatePrizePool(playerCount: number, betKz: number, isDemo: boolean): {
  totalPot: number;
  houseFee: number;
  creatorRoyalty: number;
  winnersPool: number;
  splits: { rank: number; percent: number; amount: number; title: string }[];
  threeTorneiras: ThreeTorneirasSplit;
} {
  const threeTorneiras = calculateThreeTorneiras(betKz, playerCount);

  // No modo demo, o montante é para treino/pontos virtuais
  const houseFee = isDemo ? 0 : threeTorneiras.houseFeeKz;
  const creatorRoyalty = isDemo ? 0 : threeTorneiras.creatorRoyaltyKz;
  const winnersPool = isDemo ? threeTorneiras.totalPotKz : threeTorneiras.winnersPotKz;

  const splits = [
    {
      rank: 1,
      percent: 50,
      amount: isDemo ? Math.floor(threeTorneiras.totalPotKz * 0.5) : threeTorneiras.firstPrizeKz,
      title: '🥇 1º Lugar (Grande Campeão do Trono)',
    },
    {
      rank: 2,
      percent: 20,
      amount: isDemo ? Math.floor(threeTorneiras.totalPotKz * 0.2) : threeTorneiras.secondPrizeKz,
      title: '🥈 2º Lugar (Vice-Campeão da Marginal)',
    },
    {
      rank: 3,
      percent: 0,
      amount: 0,
      title: '🥉 3º Lugar (Honra do Pódio Real)',
    },
  ];

  return {
    totalPot: threeTorneiras.totalPotKz,
    houseFee,
    creatorRoyalty,
    winnersPool,
    splits,
    threeTorneiras,
  };
}
