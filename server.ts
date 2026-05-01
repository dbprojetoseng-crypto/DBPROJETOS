import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import cors from "cors";
import { XMLParser } from "fast-xml-parser";
import fs from "fs";

console.log(">>> SERVER.TS IS STARTING <<<");

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log(`[SERVER] Starting in ${process.env.NODE_ENV || 'development'} mode`);

  app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
  });

  app.use(cors());
  app.use(express.json());

  // Test route to verify API is alive
  app.get("/api/health", (req, res) => {
    console.log("[API] Health check requested");
    res.json({ success: true, status: "ok", message: "API is alive and returning JSON" });
  });

  // Simplified API Route for testing
  app.post("/api/import-project-test", (req, res) => {
    console.log("[API] Test import route hit");
    res.json({
      success: true,
      message: "API funcionando"
    });
  });

  app.get("/api/import-project", (req, res) => {
    res.json({ success: true, message: "Use POST to import projects" });
  });

  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const upload = multer({ dest: "uploads/" });

  // API Route for MS Project XML Import
  app.post("/api/import-project", upload.single("file"), async (req, res) => {
    console.log(`[API] POST /api/import-project hit. File: ${req.file?.originalname || 'None'}`);
    
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          error: "Nenhum arquivo enviado. Por favor, envie um arquivo no campo 'file'." 
        });
      }

      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      const filePath = req.file.path;

      // Basic extension check
      if (![".xml", ".mpp", ".xlsx", ".xls"].includes(fileExtension)) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(400).json({ 
          success: false, 
          error: "Extensão de arquivo inválida. Apenas .xml e .mpp são aceitos para importação de cronograma no backend." 
        });
      }

      // Read file content
      const fileContent = fs.readFileSync(filePath, "utf-8");
      
      // Check if it's XML (MS Project XML format)
      const isXml = fileContent.trim().startsWith("<?xml") || fileContent.trim().startsWith("<Project");

      if (!isXml) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(400).json({ 
          success: false,
          error: "O arquivo enviado não é um XML válido do MS Project. Se você estiver usando um arquivo .mpp, por favor salve-o como 'XML do Project' dentro do MS Project e tente novamente." 
        });
      }

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        removeNSPrefix: true,
      });
      const jsonObj = parser.parse(fileContent);

      const project = jsonObj.Project;
      if (!project) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(400).json({ 
          success: false, 
          error: "Estrutura XML do MS Project não encontrada no arquivo." 
        });
      }

      // Extract Project Info
      const projectName = project.Name || project.Title || req.file.originalname || "Projeto Importado";

      // Extract Tasks
      const rawTasks = Array.isArray(project.Tasks?.Task) 
        ? project.Tasks.Task 
        : [project.Tasks?.Task].filter(Boolean);
      
      // Helper: parse MS Project duration string PT8H0M0S → hours
      const parseDuration = (val: any): number => {
        if (!val) return 0;
        const s = String(val);
        const h = s.match(/(\d+(?:\.\d+)?)H/);
        const m = s.match(/(\d+(?:\.\d+)?)M/);
        return (h ? parseFloat(h[1]) : 0) + (m ? parseFloat(m[1]) / 60 : 0);
      };

      // Helper: normalize MS Project cost (sometimes stored x100)
      const normCost = (val: any): number => {
        const n = parseFloat(val || 0);
        return n > 100000000 ? n / 100 : n;
      };

      const tasks = rawTasks
        .filter((t: any) => {
          const name = String(t.Name || '').trim();
          const isSummary = t.Summary === "1" || t.Summary === true;
          return name !== '' && name !== '0' && !isSummary;
        })
        .map((t: any) => {
          const progress = parseFloat(t.PercentComplete || t.PhysicalPercentComplete || 0);
          const plannedProgress = parseFloat(t.PercentComplete || 0);

          const bac = normCost(t.BaselineCost || t.Cost || 0);
          const ac  = normCost(t.ActualCost || 0);

          const plannedWork = parseDuration(t.BaselineWork || t.Work || 0);
          const actualWork  = parseDuration(t.ActualWork || 0);

          // Situation
          const situation = progress > plannedProgress
            ? 'ADIANTADO'
            : progress < plannedProgress && plannedProgress > 0
              ? 'ATRASO'
              : 'NO PRAZO';

          return {
            uid: t.UID,
            id: String(t.ID || t.UID),
            name: String(t.Name || 'Sem Nome'),
            wbs: t.WBS || t.OutlineNumber || '',
            outlineLevel: parseInt(t.OutlineLevel || 1),
            start: t.Start || t.BaselineStart || null,
            finish: t.Finish || t.BaselineFinish || null,
            actualStart: t.ActualStart || null,
            actualFinish: t.ActualFinish || null,
            duration: t.Duration || null,
            progress,
            plannedProgress,
            bac,
            ac,
            cost: bac,
            plannedWeight: plannedWork,
            actualWeight: actualWork,
            isMilestone: t.Milestone === "1" || t.Milestone === true,
            isSummary: false,
            isCritical: t.Critical === "1" || t.Critical === true,
            situation,
            predecessors: t.PredecessorLink?.PredecessorUID
              ? String(t.PredecessorLink.PredecessorUID)
              : '',
          };
        });

      // Cleanup
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      console.log(`[API] Successfully processed ${tasks.length} tasks for project: ${projectName}`);

      return res.json({
        success: true,
        projectName: projectName,
        tasks: tasks
      });

    } catch (error: any) {
      console.error("[API] Import error:", error);
      // Cleanup on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({ 
        success: false, 
        error: "Erro interno ao processar o arquivo.",
        message: error.message 
      });
    }
  });

  // 404 handler for API routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({ 
      success: false, 
      error: `Rota não encontrada: ${req.method} ${req.url}`,
      details: "O endpoint solicitado não existe no servidor."
    });
  });

  // Global error handler for API
  app.use((err: any, req: any, res: any, next: any) => {
    if (req.path.startsWith("/api/")) {
      console.error("API Error:", err);
      return res.status(500).json({ 
        success: false, 
        error: "Erro interno no servidor ao processar a requisição.",
        message: err.message
      });
    }
    next(err);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
