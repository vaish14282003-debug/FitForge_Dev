import type { Muscle } from "../types";

const m = (muscle: Omit<Muscle, "side" | "meshNames">): Muscle => ({ ...muscle, side: "bilateral", meshNames: [] });

/**
 * The superficial muscles FitForge exercises are described in. Descriptions are plain functional
 * summaries from standard anatomy references, not clinical guidance.
 */
export const MUSCLES: readonly Muscle[] = [
  m({ id: "pectoralis-major", name: "Chest", scientificName: "Pectoralis major", region: "chest", visibility: "front", group: "CHEST", description: "Brings the upper arm across and in front of the body, as in pressing and hugging." }),
  m({ id: "anterior-deltoid", name: "Front delts", scientificName: "Deltoideus (pars clavicularis)", region: "shoulders", visibility: "front", group: "SHOULDERS", description: "Raises the arm forward and helps press overhead and in front." }),
  m({ id: "lateral-deltoid", name: "Side delts", scientificName: "Deltoideus (pars acromialis)", region: "shoulders", visibility: "both", group: "SHOULDERS", description: "Lifts the arm out to the side; gives the shoulders their width." }),
  m({ id: "posterior-deltoid", name: "Rear delts", scientificName: "Deltoideus (pars spinalis)", region: "shoulders", visibility: "back", group: "SHOULDERS", description: "Pulls the arm back and turns it outward, as in rows and face pulls." }),
  m({ id: "biceps-brachii", name: "Biceps", scientificName: "Biceps brachii", region: "arms", visibility: "front", group: "BICEPS", description: "Bends the elbow and turns the palm up." }),
  m({ id: "brachialis", name: "Brachialis", scientificName: "Brachialis", region: "arms", visibility: "front", group: "BICEPS", description: "The main elbow flexor, working in every grip; sits under the biceps." }),
  m({ id: "brachioradialis", name: "Brachioradialis", scientificName: "Brachioradialis", region: "arms", visibility: "front", group: "BICEPS", description: "Bends the elbow, strongest with a neutral, thumbs-up grip." }),
  m({ id: "forearm-flexors", name: "Forearm flexors", scientificName: "Flexores antebrachii", region: "arms", visibility: "front", group: "BICEPS", description: "Close the hand and bend the wrist; they set grip strength." }),
  m({ id: "triceps-brachii", name: "Triceps", scientificName: "Triceps brachii", region: "arms", visibility: "back", group: "TRICEPS", description: "Straightens the elbow, finishing every press." }),
  m({ id: "trapezius", name: "Traps", scientificName: "Trapezius", region: "back", visibility: "back", group: "BACK", description: "Lifts, squeezes and lowers the shoulder blades." }),
  m({ id: "rhomboids", name: "Rhomboids", scientificName: "Rhomboideus major et minor", region: "back", visibility: "back", group: "BACK", description: "Pull the shoulder blades together, as at the end of a row." }),
  m({ id: "latissimus-dorsi", name: "Lats", scientificName: "Latissimus dorsi", region: "back", visibility: "back", group: "BACK", description: "Pulls the arm down and back toward the body, as in pull-ups." }),
  m({ id: "erector-spinae", name: "Lower back", scientificName: "Erector spinae", region: "back", visibility: "back", group: "BACK", description: "Holds the spine upright and extends it, keeping the back flat when lifting." }),
  m({ id: "rectus-abdominis", name: "Abs", scientificName: "Rectus abdominis", region: "core", visibility: "front", group: "CORE", description: "Curls the trunk forward and resists the lower back arching." }),
  m({ id: "obliques", name: "Obliques", scientificName: "Obliquus externus abdominis", region: "core", visibility: "front", group: "CORE", description: "Twist and side-bend the trunk, and resist rotation." }),
  m({ id: "hip-flexors", name: "Hip flexors", scientificName: "Iliopsoas", region: "hips", visibility: "front", group: "CORE", description: "Lift the thigh toward the trunk, as in leg raises and running." }),
  m({ id: "gluteus-maximus", name: "Glutes", scientificName: "Gluteus maximus", region: "hips", visibility: "back", group: "GLUTES", description: "Extends the hip, driving squats, deadlifts and hip thrusts." }),
  m({ id: "gluteus-medius", name: "Side glutes", scientificName: "Gluteus medius", region: "hips", visibility: "back", group: "GLUTES", description: "Moves the leg out to the side and keeps the pelvis level on one leg." }),
  m({ id: "adductors", name: "Adductors", scientificName: "Adductor magnus, longus et brevis", region: "thighs", visibility: "front", group: "LEGS", description: "Bring the legs together and help the hips extend in deep squats." }),
  m({ id: "quadriceps", name: "Quads", scientificName: "Quadriceps femoris", region: "thighs", visibility: "front", group: "LEGS", description: "Straighten the knee: the main muscles in squats, lunges and leg presses." }),
  m({ id: "hamstrings", name: "Hamstrings", scientificName: "Biceps femoris, semitendinosus, semimembranosus", region: "thighs", visibility: "back", group: "LEGS", description: "Bend the knee and extend the hip, as in leg curls and Romanian deadlifts." }),
  m({ id: "gastrocnemius", name: "Calves", scientificName: "Gastrocnemius", region: "lower-legs", visibility: "back", group: "LEGS", description: "Points the foot down with the knee straight, as in running and jumping." }),
  m({ id: "soleus", name: "Soleus", scientificName: "Soleus", region: "lower-legs", visibility: "back", group: "LEGS", description: "Points the foot down with the knee bent; works constantly when standing." }),
  m({ id: "tibialis-anterior", name: "Shins", scientificName: "Tibialis anterior", region: "lower-legs", visibility: "front", group: "LEGS", description: "Lifts the toes toward the shin and controls the foot as it lands." }),
];

export const REGION_LABELS: Record<Muscle["region"], string> = {
  chest: "Chest",
  shoulders: "Shoulders",
  arms: "Arms",
  back: "Back",
  core: "Core",
  hips: "Hips",
  thighs: "Thighs",
  "lower-legs": "Lower legs",
};
