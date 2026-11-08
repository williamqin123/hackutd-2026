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

export const init = spacetimedb.init((_ctx) => {
  // Called when the module is initially published
});

export const onConnect = spacetimedb.clientConnected((_ctx) => {
  // Called every time a new client connects
});

export const onDisconnect = spacetimedb.clientDisconnected((_ctx) => {
  // Called every time a client disconnects
});

export const add = spacetimedb.reducer(
  { name: t.string() },
  (ctx, { name }) => {
    ctx.db.person.insert({ name });
  },
);

export const sayHello = spacetimedb.reducer((ctx) => {
  for (const person of ctx.db.person.iter()) {
    console.info(`Hello, ${person.name}!`);
  }
  console.info("Hello, World!");
});
