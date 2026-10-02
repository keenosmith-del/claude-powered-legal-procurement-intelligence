import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { config } from "./config.js";
import { query, transaction, audit } from "./db.js";
import { AppError, eventSchema, parse } from "./schemas.js";
import {
  eventById,
  supplierById,
  comparison,
  latestAnalysis,
} from "./procurement.js";
import {
  prepareStorage,
  processText,
  removeUpload,
  extract,
} from "./documents.js";
import { analyse, whatIf } from "./analysis.js";
export const app = express();
app.use(helmet());
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  const origin = req.get("Origin");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    origin &&
    ![config.frontendUrl, "http://127.0.0.1:5173"].includes(origin)
  )
    return next(new AppError(403, "Origin is not allowed"));
  next();
});
app.use((req, res, next) => {
  const id = randomUUID();
  res.setHeader("X-Request-ID", id);
  const start = Date.now();
  res.on("finish", () =>
    console.info(
      JSON.stringify({
        requestId: id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - start,
      }),
    ),
  );
  next();
});
const uuid = (id: unknown) => parse(z.string().uuid(), id);
app.get("/api/health", async (_req, res) => {
  await query("SELECT 1");
  res.json({
    status: "ok",
    database: "postgresql",
    aiConfigured: !!process.env.ANTHROPIC_API_KEY,
    model: config.model,
  });
});
app.get("/api/procurement-events", async (_req, res) =>
  res.json(
    await query("SELECT * FROM procurement_events ORDER BY created_at DESC"),
  ),
);
app.post("/api/procurement-events", async (req, res) => {
  const data = parse(eventSchema, req.body);
  const event = await transaction(async (c) => {
    const [e] = (
      await c.query(
        "INSERT INTO procurement_events(title,description,category,requirements) VALUES($1,$2,$3,$4) RETURNING *",
        [
          data.title,
          data.description,
          data.category,
          JSON.stringify(data.requirements),
        ],
      )
    ).rows;
    for (const criterion of data.criteria)
      await c.query(
        "INSERT INTO evaluation_criteria(event_id,category,weight,description) VALUES($1,$2,$3,$4)",
        [e.id, criterion.category, criterion.weight, criterion.description],
      );
    await c.query(
      "INSERT INTO audit_events(event_id,event_type) VALUES($1,'event.created')",
      [e.id],
    );
    return e;
  });
  res.status(201).json(event);
});
app.get("/api/procurement-events/:id", async (req, res) =>
  res.json(await eventById(uuid(req.params.id))),
);
app.put("/api/procurement-events/:id", async (req, res) => {
  const id = uuid(req.params.id);
  const data = parse(eventSchema, req.body);
  await eventById(id);
  await transaction(async (c) => {
    await c.query(
      "UPDATE procurement_events SET title=$2,description=$3,category=$4,requirements=$5,revision=revision+1,status='review',updated_at=now() WHERE id=$1",
      [
        id,
        data.title,
        data.description,
        data.category,
        JSON.stringify(data.requirements),
      ],
    );
    await c.query("DELETE FROM evaluation_criteria WHERE event_id=$1", [id]);
    for (const criterion of data.criteria)
      await c.query(
        "INSERT INTO evaluation_criteria(event_id,category,weight,description) VALUES($1,$2,$3,$4)",
        [id, criterion.category, criterion.weight, criterion.description],
      );
  });
  await audit(id, "event.updated");
  res.json(await eventById(id));
});
app.get("/api/procurement-events/:id/suppliers", async (req, res) => {
  const id = uuid(req.params.id);
  await eventById(id);
  res.json(
    await query("SELECT * FROM suppliers WHERE event_id=$1 ORDER BY name", [
      id,
    ]),
  );
});
app.post("/api/procurement-events/:id/suppliers", async (req, res) => {
  const id = uuid(req.params.id);
  await eventById(id);
  const data = parse(
    z.object({
      name: z.string().trim().min(1).max(100),
      description: z.string().max(2000).default(""),
    }),
    req.body,
  );
  const s = await transaction(async (c) => {
    await c.query("SELECT id FROM procurement_events WHERE id=$1 FOR UPDATE", [
      id,
    ]);
    const [s] = (
      await c.query(
        "INSERT INTO suppliers(event_id,name,description) VALUES($1,$2,$3) RETURNING *",
        [id, data.name, data.description],
      )
    ).rows;
    await c.query(
      "UPDATE procurement_events SET revision=revision+1,status='review',updated_at=now() WHERE id=$1",
      [id],
    );
    await c.query(
      "INSERT INTO audit_events(event_id,event_type,metadata) VALUES($1,'supplier.added',$2)",
      [id, JSON.stringify({ supplierId: s.id })],
    );
    return s;
  });
  res.status(201).json(s);
});
app.put("/api/suppliers/:id", async (req, res) => {
  const s = await supplierById(uuid(req.params.id));
  const data = parse(
    z.object({
      name: z.string().trim().min(1).max(100),
      description: z.string().max(2000).default(""),
    }),
    req.body,
  );
  const updated = await transaction(async (c) => {
    await c.query("SELECT id FROM procurement_events WHERE id=$1 FOR UPDATE", [
      s.event_id,
    ]);
    const [supplier] = (
      await c.query(
        "UPDATE suppliers SET name=$2,description=$3 WHERE id=$1 RETURNING *",
        [s.id, data.name, data.description],
      )
    ).rows;
    await c.query(
      "UPDATE procurement_events SET revision=revision+1,status='review',updated_at=now() WHERE id=$1",
      [s.event_id],
    );
    await c.query(
      "INSERT INTO audit_events(event_id,event_type,metadata) VALUES($1,'supplier.updated',$2)",
      [s.event_id, JSON.stringify({ supplierId: s.id })],
    );
    return supplier;
  });
  res.json(updated);
});
app.get("/api/suppliers/:id", async (req, res) => {
  const s = await supplierById(uuid(req.params.id));
  res.json({
    ...s,
    terms: await query(
      "SELECT * FROM contract_terms WHERE supplier_id=$1 AND active",
      [s.id],
    ),
    documents: await query(
      "SELECT id,filename,mime_type,document_type,processing_status,error FROM supplier_documents WHERE supplier_id=$1",
      [s.id],
    ),
  });
});
app.get("/api/suppliers/:id/documents", async (req, res) => {
  const s = await supplierById(uuid(req.params.id));
  res.json(
    await query(
      "SELECT id,filename,mime_type,document_type,processing_status,error,created_at FROM supplier_documents WHERE supplier_id=$1",
      [s.id],
    ),
  );
});
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      prepareStorage()
        .then(() => cb(null, config.storage))
        .catch((e) => cb(e, config.storage));
    },
    filename: (_req, file, cb) =>
      cb(
        null,
        randomUUID() +
          ({
            "application/pdf": ".pdf",
            "text/plain": ".txt",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
              ".docx",
          }[file.mimetype] ?? ""),
      ),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = {
      "application/pdf": ".pdf",
      "text/plain": ".txt",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        ".docx",
    };
    if (
      !(file.mimetype in allowed) ||
      path.extname(file.originalname).toLowerCase() !==
        allowed[file.mimetype as keyof typeof allowed]
    )
      cb(
        new AppError(415, "Upload PDF, DOCX or TXT with a matching file type"),
      );
    else cb(null, true);
  },
});
app.post(
  "/api/suppliers/:id/documents",
  upload.single("file"),
  async (req, res) => {
    const file = req.file;
    if (!file) throw new AppError(400, "A document file is required");
    try {
      const s = await supplierById(uuid(req.params.id));
      const type = parse(
        z.enum([
          "contract",
          "proposal",
          "pricing",
          "sla",
          "warranty",
          "commercial",
        ]),
        req.body.documentType ?? "contract",
      );
      const d = await transaction(async (c) => {
        await c.query(
          "SELECT id FROM procurement_events WHERE id=$1 FOR UPDATE",
          [s.event_id],
        );
        const [d] = (
          await c.query(
            "INSERT INTO supplier_documents(supplier_id,document_type,filename,mime_type,storage_path) VALUES($1,$2,$3,$4,$5) RETURNING *",
            [
              s.id,
              type,
              path.basename(file.originalname),
              file.mimetype,
              file.path,
            ],
          )
        ).rows;
        await processText(d.id, c);
        await c.query(
          "UPDATE procurement_events SET revision=revision+1,status='review',updated_at=now() WHERE id=$1",
          [s.event_id],
        );
        await c.query(
          "INSERT INTO audit_events(event_id,event_type,metadata) VALUES($1,'document.uploaded',$2)",
          [s.event_id, JSON.stringify({ documentId: d.id })],
        );
        return d;
      });
      res.status(201).json({
        id: d.id,
        filename: d.filename,
        processing_status: "text_ready",
      });
    } catch (e) {
      await removeUpload(file.path);
      throw e;
    }
  },
);
app.get("/api/documents/:id", async (req, res) => {
  const [d] = await query(
    "SELECT id,supplier_id,filename,mime_type,document_type,extracted_text,processing_status,error FROM supplier_documents WHERE id=$1",
    [uuid(req.params.id)],
  );
  if (!d) throw new AppError(404, "Document not found");
  res.json({
    ...d,
    chunks: await query(
      "SELECT id,location,content FROM document_chunks WHERE document_id=$1",
      [d.id],
    ),
  });
});
app.get("/api/documents/:id/download", async (req, res) => {
  const [d] = await query("SELECT * FROM supplier_documents WHERE id=$1", [
    uuid(req.params.id),
  ]);
  if (!d) throw new AppError(404, "Document not found");
  res.download(d.storage_path, d.filename);
});
app.post("/api/documents/:id/extract", async (req, res) =>
  res.json(await extract(uuid(req.params.id))),
);
app.get("/api/procurement-events/:id/terms", async (req, res) => {
  const id = uuid(req.params.id);
  await eventById(id);
  res.json(
    await query(
      "SELECT t.*,d.filename,s.name AS supplier_name FROM contract_terms t JOIN supplier_documents d ON d.id=t.source_document_id JOIN suppliers s ON s.id=t.supplier_id WHERE s.event_id=$1 AND ($2 OR t.active) ORDER BY s.name,t.category,t.term",
      [id, req.query.history === "1"],
    ),
  );
});
app.get("/api/procurement-events/:id/comparison", async (req, res) =>
  res.json(await comparison(uuid(req.params.id))),
);
app.post("/api/procurement-events/:id/analyse", async (req, res) =>
  res.json(await analyse(uuid(req.params.id))),
);
app.get("/api/procurement-events/:id/analysis", async (req, res) => {
  const id = uuid(req.params.id);
  await eventById(id);
  res.json(await latestAnalysis(id));
});
app.get("/api/procurement-events/:id/risks", async (req, res) => {
  const id = uuid(req.params.id);
  await eventById(id);
  const a = await latestAnalysis(id);
  res.json({
    stale: a?.stale ?? false,
    risks: a
      ? await query("SELECT * FROM risks WHERE analysis_id=$1", [a.id])
      : [],
  });
});
app.get("/api/procurement-events/:id/negotiations", async (req, res) => {
  const id = uuid(req.params.id);
  await eventById(id);
  const a = await latestAnalysis(id);
  res.json({
    stale: a?.stale ?? false,
    opportunities: a
      ? await query(
          "SELECT * FROM negotiation_opportunities WHERE analysis_id=$1",
          [a.id],
        )
      : [],
  });
});
app.get("/api/procurement-events/:id/evidence", async (req, res) => {
  const a = await latestAnalysis(uuid(req.params.id));
  res.json(
    a
      ? await query(
          "SELECT e.*,d.filename FROM analysis_evidence e JOIN supplier_documents d ON d.id=e.document_id WHERE analysis_id=$1",
          [a.id],
        )
      : [],
  );
});
app.post("/api/procurement-events/:id/what-if", async (req, res) =>
  res.json(await whatIf(uuid(req.params.id), req.body)),
);
app.post("/api/procurement-events/:id/decision", async (req, res) => {
  const id = uuid(req.params.id);
  await eventById(id);
  const data = parse(
    z.object({
      outcome: z.enum(["accept", "reject", "defer"]),
      selectedSupplierId: z.string().uuid().nullable(),
      notes: z.string().min(10).max(10000),
      negotiationRequired: z.boolean(),
    }),
    req.body,
  );
  if (data.outcome === "accept" && !data.selectedSupplierId)
    throw new AppError(400, "Select a supplier for an accepted decision");
  if (
    data.selectedSupplierId &&
    (await supplierById(data.selectedSupplierId)).event_id !== id
  )
    throw new AppError(400, "Supplier belongs to a different event");
  const a = await latestAnalysis(id);
  if (a?.stale && data.outcome === "accept")
    throw new AppError(
      409,
      "Re-run the stale analysis before accepting a supplier",
    );
  const decision = await transaction(async (c) => {
    const current = (
      await c.query(
        "SELECT revision FROM procurement_events WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (a && data.outcome === "accept" && a.revision !== current.revision) {
      throw new AppError(
        409,
        "Event changed during review; rerun analysis before accepting",
      );
    }
    const [d] = (
      await c.query(
        "INSERT INTO decisions(event_id,selected_supplier_id,analysis_id,outcome,notes,negotiation_required) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
        [
          id,
          data.selectedSupplierId,
          a?.id ?? null,
          data.outcome,
          data.notes,
          data.negotiationRequired,
        ],
      )
    ).rows;
    await c.query(
      "UPDATE procurement_events SET status=$2,updated_at=now() WHERE id=$1",
      [id, data.outcome === "defer" ? "review" : "decided"],
    );
    await c.query(
      "INSERT INTO audit_events(event_id,event_type,metadata) VALUES($1,'decision.recorded',$2)",
      [id, JSON.stringify({ decisionId: d.id, outcome: data.outcome })],
    );
    return d;
  });
  res.status(201).json(decision);
});
app.get("/api/procurement-events/:id/decisions", async (req, res) => {
  const id = uuid(req.params.id);
  await eventById(id);
  res.json(
    await query(
      "SELECT * FROM decisions WHERE event_id=$1 ORDER BY decided_at DESC",
      [id],
    ),
  );
});
app.get("/api/procurement-events/:id/audit", async (req, res) => {
  const id = uuid(req.params.id);
  await eventById(id);
  res.json(
    await query(
      "SELECT * FROM audit_events WHERE event_id=$1 ORDER BY created_at DESC LIMIT 200",
      [id],
    ),
  );
});
app.use((_req, _res, next) =>
  next(new AppError(404, "API endpoint not found")),
);
app.use(
  (
    error: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status =
      error.type === "entity.parse.failed"
        ? 400
        : error.type === "entity.too.large"
          ? 413
          : error instanceof AppError
            ? error.status
            : error instanceof z.ZodError
              ? 400
              : error instanceof multer.MulterError
                ? 400
                : error.code === "23505"
                  ? 409
                  : 500;
    const message =
      error.type === "entity.parse.failed"
        ? "Request body must contain valid JSON"
        : error.type === "entity.too.large"
          ? "Request body exceeds the allowed size"
          : error instanceof AppError
            ? error.message
            : error instanceof z.ZodError
              ? "Invalid request or scenario inputs"
              : error instanceof multer.MulterError
                ? "Upload failed: " + error.message
                : status === 409
                  ? "Record already exists"
                  : "Internal operation failed. Check database and server configuration.";
    if (status === 500)
      console.error(
        JSON.stringify({
          stage: "request.failed",
          type: error.name,
          code: error.code,
        }),
      );
    res
      .status(status)
      .json({ error: message, requestId: res.getHeader("X-Request-ID") });
  },
);
