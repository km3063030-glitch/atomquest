// utils/progressScore.js
/**
 * Computes progress score (0–1) based on UoM type
 */
function computeProgressScore({ uomType, targetValue, actualValue, targetDate, actualDate }) {
  if (actualValue === null || actualValue === undefined) return null;

  switch (uomType) {
    case 'numeric_min': {
      // Higher is better — e.g., Sales Revenue
      if (!targetValue || targetValue === 0) return null;
      const score = actualValue / targetValue;
      return Math.min(score, 1.5); // cap at 150%
    }
    case 'numeric_max': {
      // Lower is better — e.g., TAT, Cost
      if (!actualValue || actualValue === 0) return 1; // Zero achievement = perfect if lower is better
      const score = targetValue / actualValue;
      return Math.min(score, 1.5);
    }
    case 'timeline': {
      // Date-based
      if (!targetDate || !actualDate) return null;
      const target = new Date(targetDate);
      const actual = new Date(actualDate);
      if (actual <= target) return 1.0; // On time or early
      const daysDiff = (actual - target) / (1000 * 60 * 60 * 24);
      // Penalize by days late
      return Math.max(0, 1 - daysDiff / 30);
    }
    case 'zero': {
      // Zero = success
      return actualValue === 0 ? 1.0 : 0.0;
    }
    default:
      return null;
  }
}

/**
 * Compute weighted overall score for a goal sheet
 */
function computeSheetScore(goals, achievements) {
  let totalWeightedScore = 0;
  let totalWeightage = 0;

  goals.forEach(goal => {
    const goalAchievements = achievements.filter(a => a.goal_id === goal.id);
    if (goalAchievements.length === 0) return;

    // Use latest/highest achievement
    const latest = goalAchievements[goalAchievements.length - 1];
    const score = computeProgressScore({
      uomType: goal.uom_type,
      targetValue: goal.target_value,
      actualValue: latest.actual_value,
      targetDate: goal.target_date,
      actualDate: latest.actual_date
    });

    if (score !== null) {
      totalWeightedScore += score * goal.weightage;
      totalWeightage += goal.weightage;
    }
  });

  if (totalWeightage === 0) return 0;
  return (totalWeightedScore / totalWeightage) * 100;
}

module.exports = { computeProgressScore, computeSheetScore };
