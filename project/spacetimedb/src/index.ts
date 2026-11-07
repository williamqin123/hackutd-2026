import { schema, table, t, Range } from "spacetimedb/server";

// Flood data schema
const floodFields = {
  OBJECTID: t.i64(),
  latitude_dd: t.f64(),
  longitude_dd: t.f64(),
  eventName: t.string(),
  hwmTypeName: t.string(),
  hwmQualityName: t.string(),
  verticalDatumName: t.string(),
  verticalMethodName: t.string(),
  horizontalMethodName: t.string(),
  horizontalDatumName: t.string(),
  site_no: t.option(t.string()),
  siteDescription: t.option(t.string()),
  countyName: t.option(t.string()),
  siteZone: t.option(t.string()),
  sitePermHousing: t.option(t.string()),
  hwm_id: t.option(t.i64()),
  waterbody: t.option(t.string()),
  site_id: t.option(t.i64()),
  event_id: t.option(t.i64()),
  hwm_type_id: t.option(t.i64()),
  hwm_quality_id: t.option(t.i64()),
  hwm_locationdescription: t.option(t.string()),
  survey_date: t.option(t.string()),
  elev_ft: t.option(t.f64()),
  bank: t.option(t.string()),
  marker_id: t.option(t.i64()),
  height_above_gnd: t.option(t.f64()),
  hwm_environment: t.option(t.string()),
  hwm_label: t.option(t.string()),

  // ISO 8601 timestamp; empty string means unknown
  SurveyDate: t.string(),
};

const floodData = table(
  {
    public: true,
    indexes: [
      {
        accessor: "surveyDateIdx",
        algorithm: "btree",
        columns: ["SurveyDate"],
      },
    ],
  },
  floodFields,
);

const spacetimedb = schema({ floodData });

export default spacetimedb;

// Normalize optional fields before database insertion
function normalizeFlood<
  T extends {
    SurveyDate?: string;
    site_no?: string;
    siteDescription?: string;
    countyName?: string;
    siteZone?: string;
    sitePermHousing?: string;
    hwm_id?: bigint;
    waterbody?: string;
    site_id?: bigint;
    event_id?: bigint;
    hwm_type_id?: bigint;
    hwm_quality_id?: bigint;
    hwm_locationdescription?: string;
    survey_date?: string;
    elev_ft?: number;
    bank?: string;
    marker_id?: bigint;
    height_above_gnd?: number;
    hwm_environment?: string;
    hwm_label?: string;
  },
>(record: T) {
  return {
    ...record,
    site_no: record.site_no,
    siteDescription: record.siteDescription,
    countyName: record.countyName,
    siteZone: record.siteZone,
    sitePermHousing: record.sitePermHousing,
    hwm_id: record.hwm_id,
    waterbody: record.waterbody,
    site_id: record.site_id,
    event_id: record.event_id,
    hwm_type_id: record.hwm_type_id,
    hwm_quality_id: record.hwm_quality_id,
    hwm_locationdescription: record.hwm_locationdescription,
    survey_date: record.survey_date,
    elev_ft: record.elev_ft,
    bank: record.bank,
    marker_id: record.marker_id,
    height_above_gnd: record.height_above_gnd,
    hwm_environment: record.hwm_environment,
    hwm_label: record.hwm_label,
    SurveyDate: record.SurveyDate ?? "",
  };
}

// Find flood record by OBJECTID
function findFlood(
  ctx: Parameters<Parameters<typeof spacetimedb.reducer>[1]>[0],
  objectId: bigint,
) {
  for (const flood of ctx.db.floodData.iter()) {
    if (flood.OBJECTID === objectId) {
      return flood;
    }
  }
  return undefined;
}

// CREATE
export const createFlood = spacetimedb.reducer(floodFields, (ctx, record) => {
  if (findFlood(ctx, record.OBJECTID)) {
    throw new Error(`Flood record ${record.OBJECTID} already exists`);
  }

  ctx.db.floodData.insert(normalizeFlood(record));
});

// UPDATE
export const updateFlood = spacetimedb.reducer(floodFields, (ctx, record) => {
  const existing = findFlood(ctx, record.OBJECTID);

  if (!existing) {
    throw new Error(`Flood record ${record.OBJECTID} not found`);
  }

  ctx.db.floodData.delete(existing);
  ctx.db.floodData.insert(normalizeFlood(record));
});

// DELETE
export const deleteFlood = spacetimedb.reducer(
  { OBJECTID: t.i64() },
  (ctx, { OBJECTID }) => {
    const existing = findFlood(ctx, OBJECTID);

    if (!existing) {
      throw new Error(`Flood record ${OBJECTID} not found`);
    }

    ctx.db.floodData.delete(existing);
  },
);

// BULK NEW GET
// Returns all flood records after a specified timestamp.
// Uses the SurveyDate B-tree index.
export const getFloodsAfter = spacetimedb.anonymousView(
  {
    name: "get_floods_after",
    public: true,
  },
  {
    timestamp: t.string(),
  },
  t.array(floodData.rowType),
  (ctx, { timestamp }) => {
    return Array.from(
      ctx.db.floodData.surveyDateIdx.filter(
        new Range({ tag: "excluded", value: timestamp }, { tag: "unbounded" }),
      ),
    );
  },
);

// Lifecycle hooks
export const init = spacetimedb.init((_ctx) => {});

export const onConnect = spacetimedb.clientConnected((_ctx) => {});

export const onDisconnect = spacetimedb.clientDisconnected((_ctx) => {});
