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

  const houseFee = isDemo ? 0 : threeTorneiras.houseFeeKz;
  const creatorRoyalty = isDemo ? 0 : threeTorneiras.creatorRoyaltyKz;
  const winnersPool = threeTorneiras.winnersPotKz;

  const splits = [
    {
      rank: 1,
      percent: threeTorneiras.firstPercent ?? 50,
      amount: threeTorneiras.firstPrizeKz,
      title: '🥇 1º Lugar (Grande Campeão do Trono)',
    },
    ...(threeTorneiras.secondPrizeKz > 0
      ? [
          {
            rank: 2,
            percent: threeTorneiras.secondPercent ?? 20,
            amount: threeTorneiras.secondPrizeKz,
            title: '🥈 2º Lugar (Vice-Campeão da Marginal)',
          },
        ]
      : [
          {
            rank: 2,
            percent: 0,
            amount: 0,
            title: '❌ 2º Lugar (Perde no Duelo 1v1)',
          },
        ]),
    ...(threeTorneiras.playerCount && threeTorneiras.playerCount >= 3
      ? [
          {
            rank: 3,
            percent: threeTorneiras.thirdPercent ?? 0,
            amount: threeTorneiras.thirdPrizeKz,
            title: threeTorneiras.thirdKeepsStake
              ? '🛡️ 3º Lugar (Aposta Mantida · Sem Perda)'
              : '❌ 3º Lugar (Último de 3 · Sem Prémio)',
          },
        ]
      : []),
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
