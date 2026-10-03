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
  | 'personalInjected'
  | 'netBalance'
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
  personalInjected: {
    title: 'Argent personnel injecté',
    body: (
      <>
        <p>Tout l'argent que vous avez mis de votre poche dans le bien depuis le début. Ce montant ne diminue jamais.</p>
        <Formula>Apport initial + déficits mensuels couverts de votre poche</Formula>
        <p>
          <b>Apport initial</b> = coût d'acquisition − montant emprunté (montants réels, sinon prévus), compté dès que le
          bien est marqué « acheté ».
        </p>
        <p>
          <b>Déficits couverts</b> : mois par mois, le bien a sa propre trésorerie (loyers − dépenses courantes :
          mensualités, charges, taxes…). Quand elle ne suffit pas, le manque vient de votre poche. Un excédent reste dans
          le bien et sert les mois suivants : il n'efface pas une injection passée.
        </p>
        <p>Les paiements d'achat (prix, notaire, travaux…) ne s'y ajoutent pas : ils sont déjà couverts par l'apport et le prêt.</p>
        <p>Pensez à saisir vos mensualités de crédit comme mouvements pour qu'elles soient comptées.</p>
      </>
    ),
  },
  netBalance: {
    title: 'Solde net du projet',
    body: (
      <>
        <p>Ce que le bien vous a rapporté (positif) ou coûté (négatif) jusqu'à aujourd'hui, en trésorerie.</p>
        <Formula>Recettes encaissées − dépenses courantes payées − apport initial</Formula>
        <p>
          La part de l'achat payée par la banque n'est comptée qu'à travers les mensualités remboursées : rien n'est compté
          deux fois. Le capital remboursé est compté comme une dépense, même s'il vous enrichit.
        </p>
        <p>
          Les charges récupérables (versées par le locataire puis reversées) sont neutres : elles n'augmentent ni ce
          solde, ni le résultat, ni la rentabilité.
        </p>
      </>
    ),
  },
  prevuReel: {
    title: 'Prévu, réel, réalisé',
    body: (
      <>
        <p>
          <b>Prévu</b> : votre estimation avant l'achat.
        </p>
        <p>
          <b>Réel</b> : les caractéristiques définitives du projet (prix signé, prêt accordé, mensualité de la banque,
          loyer du bail, taxe foncière connue…), saisies dans « Projet ». Tant qu'un montant réel manque, le prévu est
          utilisé à sa place : les indicateurs concernés sont marqués d'un petit rond creux.
        </p>
        <p>
          <b>Réalisé</b> : ce qui a effectivement été payé et encaissé, au fil du temps (mouvements). Un mouvement ne
          modifie jamais automatiquement le réel : un acompte de travaux n'est pas le coût final. Si un paiement dépasse
          le montant utilisé par les calculs, l'application vous le signale.
        </p>
        <p>
          <b>Écart</b> = réel − prévu. En vert quand c'est favorable (coût plus bas, loyer plus haut), en rouge sinon.
        </p>
      </>
    ),
  },
};
