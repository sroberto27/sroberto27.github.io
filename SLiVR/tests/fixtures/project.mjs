/**
 * A deterministic project fixture covering every workspace store.
 *
 * IDs are fixed rather than generated, so a round-trip comparison shows that
 * identifiers and relationships survived rather than that new ones were made.
 * The catalog references point at real records in catalog 1.0.0.
 */

const ISO = "2026-09-20T12:00:00.000Z";

/** A stable, well-formed workspace ID. */
export function fixedId(prefix, n) {
  const tail = String(n).padStart(12, "0");
  return `${prefix}_00000000-0000-4000-8000-${tail}`;
}

export const FIXTURE_IDS = Object.freeze({
  project: fixedId("prj", 1),
  sceneA: fixedId("scn", 1),
  sceneB: fixedId("scn", 2),
  candidateA: fixedId("cnd", 1),
  candidateB: fixedId("cnd", 2),
  candidateC: fixedId("cnd", 3),
  bookmark: fixedId("bkm", 1),
  shotScene: fixedId("sht", 1),
  camera: fixedId("obj", 1),
  actor: fixedId("obj", 2),
  path: fixedId("pth", 1),
  shot: fixedId("shot", 1),
  variant: fixedId("var", 1),
});

const emptyLists = {
  requiredSpaces: [],
  vehicles: [],
  equipment: [],
  mustHave: [],
  preferred: [],
  rejectionConditions: [],
  openQuestions: [],
};

/**
 * Builds the fixture bundle.
 * @param {{catalogVersion?: string}} [options]
 */
export function projectFixture({ catalogVersion = "1.0.0" } = {}) {
  const project = {
    id: FIXTURE_IDS.project,
    name: "Pilot short — downtown nights",
    productionType: "Short film",
    description: "Two scenes used to exercise the foundation.",
    status: "active",
    timeZone: "America/Chicago",
    createdAt: ISO,
    updatedAt: ISO,
    revision: 1,
  };

  const scenes = [
    {
      id: FIXTURE_IDS.sceneA,
      projectId: project.id,
      number: "12",
      title: "Cafe conversation",
      storyLocation: "A corner cafe",
      intExt: "INT",
      dayNight: "NIGHT",
      description: "Two characters at a window table.",
      ...emptyLists,
      requiredSpaces: ["Main room", "Street-facing window"],
      mustHave: ["Practical window light", "Room for a two-shot"],
      preferred: ["Period-neutral fittings"],
      openQuestions: ["Whether filming is permitted after closing"],
      castCount: 2,
      extrasCount: 4,
      crewSize: 9,
      notes: "",
      createdAt: ISO,
      updatedAt: ISO,
      revision: 1,
    },
    {
      id: FIXTURE_IDS.sceneB,
      projectId: project.id,
      number: "13",
      title: "Street exit",
      intExt: "EXT",
      dayNight: "NIGHT",
      ...emptyLists,
      mustHave: ["Continuous pavement for a walking exit"],
      createdAt: ISO,
      updatedAt: ISO,
      revision: 1,
    },
  ];

  const candidates = [
    {
      id: FIXTURE_IDS.candidateA,
      projectId: project.id,
      sceneId: FIXTURE_IDS.sceneA,
      locationId: "LOC-001",
      captureId: "CAP-001",
      catalogVersion,
      status: "preferred",
      addedAt: ISO,
      rationale: "Window table matches the scene.",
      strengths: ["Window light", "Compact room"],
      concerns: ["Ambient street noise"],
      missingInfo: ["Filming permission", "Availability after closing"],
      requirementAssessments: [
        { requirement: "Practical window light", kind: "mustHave", result: "met" },
        {
          requirement: "Room for a two-shot",
          kind: "mustHave",
          result: "unknown",
          note: "Needs an on-site measurement.",
        },
      ],
      decisionNotes: "Preferred pending access confirmation.",
      updatedAt: ISO,
      revision: 2,
    },
    {
      id: FIXTURE_IDS.candidateB,
      projectId: project.id,
      sceneId: FIXTURE_IDS.sceneA,
      locationId: "LOC-003",
      captureId: "CAP-003",
      catalogVersion,
      status: "backup",
      addedAt: ISO,
      strengths: [],
      concerns: [],
      missingInfo: ["Public hours on a shoot date"],
      requirementAssessments: [],
      updatedAt: ISO,
      revision: 1,
    },
    {
      id: FIXTURE_IDS.candidateC,
      projectId: project.id,
      sceneId: FIXTURE_IDS.sceneB,
      locationId: "LOC-012",
      catalogVersion,
      status: "considering",
      addedAt: ISO,
      strengths: [],
      concerns: ["No immersive capture exists"],
      missingInfo: ["Everything below the catalog summary"],
      requirementAssessments: [],
      updatedAt: ISO,
      revision: 1,
    },
  ];

  const bookmarks = [
    {
      id: FIXTURE_IDS.bookmark,
      projectId: project.id,
      locationId: "LOC-001",
      captureId: "CAP-001",
      candidateId: FIXTURE_IDS.candidateA,
      catalogVersion,
      experienceId: "5eb11a1b",
      sweepId: "sebf1e31m9u7dk7twchgfz1mc",
      // Only the supplied entry coordinates are known; no pose was reported,
      // so no yaw or pitch is recorded rather than a placeholder zero.
      view: { x: 4.479141140601165, y: 76.06015671262044 },
      supportedFields: ["x", "y"],
      name: "Window table",
      note: "Entry point supplied with the capture.",
      createdAt: ISO,
      captureVersionRef: "catalog-1.0.0/CAP-001",
      adapterCapabilityVersion: "unverified-0",
      revision: 1,
    },
  ];

  const shotScenes = [
    {
      id: FIXTURE_IDS.shotScene,
      projectId: project.id,
      sceneId: FIXTURE_IDS.sceneA,
      candidateId: FIXTURE_IDS.candidateA,
      locationId: "LOC-001",
      catalogVersion,
      name: "Scene 12 — window two-shot",
      origin: {
        lon: -92.018864,
        lat: 30.2215626,
        groundElevationM: 0,
        elevationDatum: "Assumed local ground plane; no survey datum established",
      },
      northOffsetDeg: 0,
      units: "metric",
      backgroundRef: { kind: "grid", note: "No plan imported yet." },
      calibration: { accuracyMode: "schematic" },
      activeVariantId: FIXTURE_IDS.variant,
      frameVersion: 1,
      createdAt: ISO,
      updatedAt: ISO,
      revision: 1,
    },
  ];

  const sceneObjects = [
    {
      id: FIXTURE_IDS.camera,
      shotSceneId: FIXTURE_IDS.shotScene,
      type: "camera",
      label: "A camera",
      // Heading zero is a real direction and must survive the round trip.
      transform: { x: 0, y: 0, z: 1.2, headingDeg: 0 },
      props: { mountHeightM: 1.2 },
      revision: 1,
    },
    {
      id: FIXTURE_IDS.actor,
      shotSceneId: FIXTURE_IDS.shotScene,
      type: "actor",
      label: "Character A",
      transform: { x: 2.5, y: 3, z: 0, headingDeg: 180 },
      props: {},
      revision: 1,
    },
  ];

  const paths = [
    {
      id: FIXTURE_IDS.path,
      shotSceneId: FIXTURE_IDS.shotScene,
      ownerObjectId: FIXTURE_IDS.actor,
      points: [
        { x: 2.5, y: 3, atS: 0 },
        { x: 0.5, y: 1.2, atS: 4 },
      ],
      interpolation: "linear",
      durationS: 4,
      revision: 1,
    },
  ];

  const variants = [
    {
      id: FIXTURE_IDS.variant,
      shotSceneId: FIXTURE_IDS.shotScene,
      name: "Wide first",
      frameVersion: 1,
      createdAt: ISO,
      revision: 1,
    },
  ];

  const shots = [
    {
      id: FIXTURE_IDS.shot,
      shotSceneId: FIXTURE_IDS.shotScene,
      variantId: FIXTURE_IDS.variant,
      cameraObjectId: FIXTURE_IDS.camera,
      order: 0,
      number: "12A",
      shotType: "Two-shot",
      lens: { focalLengthMm: 35, gateWidthMm: 24.89, gateHeightMm: 18.67, gateName: "Super-35" },
      aspectRatio: 1.85,
      description: "Static two-shot across the window table.",
      movement: "Locked off",
      estimatedDurationS: 20,
      status: "planned",
      revision: 1,
    },
  ];

  return {
    projects: [project],
    scenes,
    candidates,
    bookmarks,
    shotScenes,
    sceneObjects,
    paths,
    shots,
    variants,
    assets: [],
  };
}
