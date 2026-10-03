/**
 * Textes d'aide : les formules affichées à l'utilisateur.
 * Ils décrivent exactement ce que calcule src/calc/metrics.ts.
 */
import type { ReactNode } from 'react';
import { Formula } from '../ui/Fields';

export type ExplainKey =
  | 'totalCost'
  | 'personalInvested'
  | 'rent'
  | 'payment'
  | 'charges'
  | 'cashflow'
  | 'savingsEffort'
  | 'grossYield'
  | 'netYield'
  | 'cashOnCash'
  | 'personalOut'
  | 'prevuReel';

export const EXPLAIN: Record<ExplainKey, { title: string; body: ReactNode }> = {
  totalCost: {
    title: 'Coût total du projet',
    body: (
      <>
        <p>Tout ce que coûte l'acquisition, avant la mise en location.</p>
        <Formula>
          Prix d'achat + frais de notaire + frais d'agence + frais de dossier + garantie + courtier + travaux +
          mobilier + autres frais
        </Formula>
        <p>Les intérêts et l'assurance du crédit n'y sont pas : ils sont payés au fil des mensualités.</p>
      </>
    ),
  },
  personalInvested: {
    title: 'Investi personnellement',
    body: (
      <>
        <p>L'argent que vous mettez vous-même dans le projet, au départ.</p>
        <Formula>(Coût total du projet − montant emprunté) + dépenses ponctuelles</Formula>
        <p>
          Il comprend votre apport, les frais et travaux non financés par le crédit, ainsi que les dépenses
          ponctuelles saisies dans « Charges ». Jamais négatif.
        </p>
      </>
    ),
  },
  rent: {
    title: 'Loyer',
    body: (
      <>
        <p>Loyer mensuel hors charges, celui qui sert aux calculs de rentabilité.</p>
        <p>
          Les charges récupérables sont payées par le locataire puis reversées (copropriété, eau…) : elles ne
          rapportent rien au propriétaire et sont donc exclues.
        </p>
        <p>Dans le cash-flow et la rentabilité nette, le loyer est réduit de la vacance locative et de la provision pour impayés.</p>
      </>
    ),
  },
  payment: {
    title: 'Mensualité',
    body: (
      <>
        <Formula>Mensualité du crédit (hors assurance) + assurance emprunteur mensuelle</Formula>
        <p>
          Calculée automatiquement à partir du capital, du taux et de la durée (prêt amortissable à mensualités
          constantes). Si votre banque vous donne le montant exact, saisissez-le : il remplace le calcul.
        </p>
      </>
    ),
  },
  charges: {
    title: 'Charges propriétaire',
    body: (
      <>
        <p>Charges récurrentes payées par vous, ramenées au mois.</p>
        <Formula>Charges mensuelles + charges annuelles ÷ 12</Formula>
        <p>Les dépenses ponctuelles ne sont pas lissées : elles comptent dans l'argent investi.</p>
      </>
    ),
  },
  cashflow: {
    title: 'Cash-flow mensuel',
    body: (
      <>
        <p>Ce qui vous reste (ou ce que vous ajoutez) chaque mois.</p>
        <Formula>
          Loyer conservé − mensualité de crédit − assurance emprunteur − charges propriétaire ramenées au mois
        </Formula>
        <p>
          Loyer conservé = loyer hors charges × (12 − mois de vacance) ÷ 12 × (1 − provision impayés). Les
          charges annuelles (taxe foncière…) sont provisionnées chaque mois.
        </p>
        <p>Avant impôts.</p>
      </>
    ),
  },
  savingsEffort: {
    title: "Effort d'épargne",
    body: (
      <>
        <p>Quand le cash-flow est négatif : la somme à ajouter de votre poche chaque mois.</p>
        <Formula>Effort d'épargne = − cash-flow (si le cash-flow est négatif, sinon 0)</Formula>
      </>
    ),
  },
  grossYield: {
    title: 'Rentabilité brute',
    body: (
      <>
        <Formula>Loyer annuel hors charges ÷ coût total du projet × 100</Formula>
        <p>Loyer sur 12 mois pleins, sans vacance ni charges. Utile pour comparer des annonces entre elles.</p>
      </>
    ),
  },
  netYield: {
    title: 'Rentabilité nette (avant impôts)',
    body: (
      <>
        <Formula>
          (Loyers annuels conservés − charges annuelles du propriétaire) ÷ coût total du projet × 100
        </Formula>
        <p>
          Tient compte de la vacance, des impayés et des charges récurrentes. Ne déduit pas le crédit (ni intérêts
          ni capital) : c'est la rentabilité du bien lui-même, quel que soit son financement.
        </p>
        <p>Avant fiscalité : impôts et prélèvements sociaux ne sont pas pris en compte.</p>
      </>
    ),
  },
  cashOnCash: {
    title: 'Rendement de mon apport',
    body: (
      <>
        <p>Ce que rapporte chaque année l'argent que vous avez personnellement mis dans le projet.</p>
        <Formula>Cash-flow annuel ÷ argent investi personnellement × 100</Formula>
        <p>
          Indicateur de trésorerie : le remboursement du capital est compté comme une dépense, alors qu'il
          vous enrichit (vous possédez une part croissante du bien). Le rendement réel de l'opération est donc
          supérieur à ce chiffre.
        </p>
        <p>Non calculable si vous n'avez rien investi personnellement (financement à 100 % et plus).</p>
      </>
    ),
  },
  personalOut: {
    title: 'Sorti de ma poche',
    body: (
      <>
        <p>Calculé à partir de ce que vous avez réellement payé et encaissé (mouvements).</p>
        <Formula>
          (Coût réel de l'achat − montant réellement emprunté) + déficit cumulé des mouvements d'exploitation
        </Formula>
        <p>
          Déficit cumulé = dépenses enregistrées hors achat (mensualités, assurance, charges, taxes…) − recettes
          enregistrées, s'il est positif. Pensez à saisir vos mensualités de crédit comme mouvements pour qu'elles
          soient comptées.
        </p>
        <p>Un excédent n'est pas déduit de votre apport : il apparaît dans « Résultat hors achat ».</p>
      </>
    ),
  },
  prevuReel: {
    title: 'Prévu, réel, écart',
    body: (
      <>
        <p>
          <b>Prévu</b> : votre simulation, avant l'achat.
        </p>
        <p>
          <b>Réel</b> : chaque montant réel connu remplace le montant prévu. Tant qu'un montant réel n'est pas
          saisi, le prévu est utilisé.
        </p>
        <p>
          Les mouvements ne remplacent pas automatiquement un montant prévu (un acompte de travaux n'est pas le coût
          final). Dans « Projet › Achat », le montant déjà payé est affiché et peut être repris comme réel en un
          geste.
        </p>
        <p>
          <b>Écart</b> = réel − prévu. En vert quand c'est favorable (coût plus bas, loyer plus haut), en rouge
          sinon.
        </p>
      </>
    ),
  },
};
