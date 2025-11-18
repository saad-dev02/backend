// utils/expressionBuilder.js
// Helpers to convert user expressions (with variable tags like GFR, OFR) into
// SQL expressions referencing JSON data or aggregated columns.

const buildExpressionQuery = (expression, dataPath = 'dl.data') => {
  if (!expression) return null;

  // Match uppercase words and underscores (variable tags)
  const variableTags = expression.match(/\b[A-Z_]+\b/g) || [];
  const uniqueTags = [...new Set(variableTags)];

  let sqlExpression = expression;
  for (const tag of uniqueTags) {
    // Reference JSON field and coerce to numeric (use COALESCE to avoid nulls)
    const jsonRef = `COALESCE((${dataPath}->>'${tag}')::numeric, 0)`;
    sqlExpression = sqlExpression.replace(new RegExp(`\\b${tag}\\b`, 'g'), jsonRef);
  }

  return sqlExpression;
};

const buildExpressionCase = (expression, dataPath = 'dl.data') => {
  if (!expression) return null;

  const sqlExpression = buildExpressionQuery(expression, dataPath);
  // Ensure a safe fallback to 0 if the computed expression is NULL
  return `CASE WHEN ${sqlExpression} IS NOT NULL THEN ${sqlExpression} ELSE 0 END`;
};

const extractDependentVariables = (expression) => {
  if (!expression) return [];
  const variableTags = expression.match(/\b[A-Z_]+\b/g) || [];
  return [...new Set(variableTags)];
};

/**
 * Build a post-aggregation expression that references the *already-aggregated*
 * columns produced by a previous CTE (for example: summed AS (SELECT SUM(v) AS v ...)).
 *
 * IMPORTANT: do NOT wrap these references in aggregate functions (SUM) here
 * — the CTE should already produce the aggregated columns. We only wrap with
 * COALESCE(...) to ensure null-safety when evaluating the expression.
 *
 * Example:
 *   expression = "(OFR + WFR) / (GFR + 0.0001)"
 *   returns "(COALESCE(OFR, 0) + COALESCE(WFR, 0)) / (COALESCE(GFR, 0) + 0.0001)"
 */
const buildPostAggregationExpression = (expression) => {
  if (!expression) return null;

  const variableTags = extractDependentVariables(expression);
  let sqlExpression = expression;

  // Replace each tag with a reference to the aggregated column (null-safe)
  for (const tag of variableTags) {
    const colRef = `COALESCE(${tag}, 0)`;
    sqlExpression = sqlExpression.replace(new RegExp(`\\b${tag}\\b`, 'g'), colRef);
  }

  return sqlExpression;
};

module.exports = {
  buildExpressionQuery,
  buildExpressionCase,
  extractDependentVariables,
  buildPostAggregationExpression
};
