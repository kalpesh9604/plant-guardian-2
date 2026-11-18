
function analyzePlant(plant, symptoms = []) {
  let healthScore = 100;
  const recommendations = [];

  const lastWatered = plant.last_watered_at
    ? new Date(plant.last_watered_at)
    : null;

  const now = new Date();

  // WATERING ANALYSIS
  if (!lastWatered) {
    healthScore -= 15;

    recommendations.push({
      category: "watering",
      priority: "medium",
      message: "No watering history found. Check the soil before watering."
    });
  } else {
    const daysSinceWatering = Math.floor(
      (now - lastWatered) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceWatering >= plant.watering_interval_days) {
      healthScore -= 20;

      recommendations.push({
        category: "watering",
        priority: "high",
        message: "Your plant may be due for watering. Check soil moisture first."
      });
    }
  }

  // SUNLIGHT ANALYSIS
  if (!plant.sunlight_preference) {
    healthScore -= 5;

    recommendations.push({
      category: "sunlight",
      priority: "low",
      message: "Add a sunlight preference to receive better care guidance."
    });
  }

  // SYMPTOM ANALYSIS
  
const symptomRules = {
  "yellow leaves": {
    category: "disease",
    priority: "medium",
    message: "Yellow leaves may indicate overwatering, underwatering or nutrient deficiency. Check soil moisture and drainage."
  },
  "brown tips": {
    category: "disease",
    priority: "medium",
    message: "Brown tips may indicate low humidity, mineral buildup or inconsistent watering. Check water quality and humidity."
  },
  "wilting": {
    category: "disease",
    priority: "high",
    message: "Wilting may indicate watering stress or root damage. Check soil moisture before watering."
  },
  "spots": {
    category: "disease",
    priority: "medium",
    message: "Leaf spots may indicate fungal or bacterial problems. Remove badly affected leaves and avoid wetting foliage."
  },
  "drooping leaves": {
    category: "health",
    priority: "medium",
    message: "Drooping leaves can result from water stress, temperature changes or root problems. Inspect the soil and growing conditions."
  },
  "curling leaves": {
    category: "health",
    priority: "medium",
    message: "Curling leaves may indicate heat stress, pests or inconsistent watering. Inspect both sides of the leaves."
  },
  "white powder": {
    category: "disease",
    priority: "high",
    message: "White powdery growth may indicate powdery mildew. Isolate the plant and improve airflow while checking the affected leaves."
  },
  "mold on soil": {
    category: "soil",
    priority: "medium",
    message: "Surface mold can indicate consistently damp soil and poor airflow. Allow the soil surface to dry and check drainage."
  },
  "pests": {
    category: "pest",
    priority: "high",
    message: "Inspect stems and both sides of leaves for insects. Identify the pest before choosing a treatment."
  },
  "root rot": {
    category: "disease",
    priority: "high",
    message: "Root rot may result from waterlogged soil. Check roots for dark, mushy tissue and improve drainage."
  }
};


  const uniqueSymptoms = [...new Set(
    symptoms.map(symptom => String(symptom).toLowerCase().trim())
  )];

  uniqueSymptoms.forEach((key) => {
    const rule = symptomRules[key];

    if (rule) {
      healthScore -= 10;
      recommendations.push(rule);
    }
  });

  healthScore = Math.max(0, Math.min(100, healthScore));

  let healthStatus = "Excellent";

  if (healthScore < 50) {
    healthStatus = "Needs Attention";
  } else if (healthScore < 75) {
    healthStatus = "Fair";
  } else if (healthScore < 90) {
    healthStatus = "Good";
  }

  if (recommendations.length === 0) {
    recommendations.push({
      category: "general",
      priority: "low",
      message: "Your plant looks good based on the available care information. Continue monitoring it regularly."
    });
  }

  return {
    healthScore,
    healthStatus,
    recommendations,
    analyzedAt: new Date().toISOString()
  };
}

module.exports = { analyzePlant };

