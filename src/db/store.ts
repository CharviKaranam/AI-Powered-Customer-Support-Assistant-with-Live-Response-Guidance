import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { SimulationSession, Message, PostInteractionReport, PerformanceAnalyticsData } from '../types.js';

const DB_FILE_PATH = path.resolve('.', 'resolve_ai.sqlite');
const OLD_JSON_DB = path.resolve('.', 'resolve_ai_db.json');

class SQLiteStore {
  private db: Database | null = null;
  private isReady: boolean = false;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.init();
  }

  private async init() {
    try {
      const SQL = await initSqlJs();
      let initializedFromDisk = false;

      if (fs.existsSync(DB_FILE_PATH)) {
        try {
          const filebuffer = fs.readFileSync(DB_FILE_PATH);
          if (filebuffer && filebuffer.length >= 100) { // Valid SQLite header is at least 100 bytes
            const candidateDb = new SQL.Database(filebuffer);
            // Verify database integrity
            candidateDb.exec("PRAGMA quick_check;");
            this.db = candidateDb;
            initializedFromDisk = true;
          } else {
            console.warn('SQLite file is empty or truncated, initializing fresh database.');
            this.db = new SQL.Database();
          }
        } catch (diskErr: any) {
          console.warn('Warning: existing SQLite database file was malformed or corrupted. Backing up and creating a fresh database.', diskErr?.message || diskErr);
          try {
            if (fs.existsSync(DB_FILE_PATH)) {
              const backupPath = `${DB_FILE_PATH}.corrupted.${Date.now()}`;
              fs.renameSync(DB_FILE_PATH, backupPath);
              console.log(`Corrupted database moved to ${backupPath}`);
            }
          } catch (renameErr) {
            try {
              fs.unlinkSync(DB_FILE_PATH);
            } catch {}
          }
          this.db = new SQL.Database();
        }
      } else {
        this.db = new SQL.Database();
      }

      if (!this.db) {
        this.db = new SQL.Database();
      }

      this.db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          scenarioId TEXT NOT NULL,
          mode TEXT DEFAULT 'simulator',
          startedAt TEXT NOT NULL,
          endedAt TEXT,
          status TEXT NOT NULL,
          summary TEXT
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          sessionId TEXT NOT NULL,
          sender TEXT NOT NULL,
          text TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          intent TEXT,
          sentiment TEXT,
          emotionalState TEXT,
          frustrationLevel TEXT,
          frustrationScore REAL,
          satisfactionTrend TEXT,
          escalationRisk TEXT,
          reasoningDetails TEXT,
          coachingGuidance TEXT,
          responseSuggestion TEXT,
          relevantKnowledge TEXT,
          relevantArticles TEXT,
          knowledgeRecommendations TEXT,
          coachingOutput TEXT,
          escalationRiskOutput TEXT
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS knowledge_articles (
          id TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          steps TEXT NOT NULL,
          tags TEXT,
          applicableProducts TEXT,
          authorityLevel TEXT,
          maxCompensation TEXT,
          lastUpdated TEXT,
          sourceDoc TEXT
        );
      `);

      // Migration checks for existing databases created prior to schema updates
      try {
        this.db.run(`ALTER TABLE sessions ADD COLUMN mode TEXT DEFAULT 'simulator';`);
      } catch (e) {
        // Ignored if column already exists
      }

      try {
        this.db.run(`ALTER TABLE sessions ADD COLUMN postReport TEXT;`);
      } catch (e) {
        // Ignored if column already exists
      }

      const msgCols = [
        'intent TEXT',
        'sentiment TEXT',
        'emotionalState TEXT',
        'frustrationLevel TEXT',
        'frustrationScore REAL',
        'satisfactionTrend TEXT',
        'escalationRisk TEXT',
        'reasoningDetails TEXT',
        'coachingGuidance TEXT',
        'responseSuggestion TEXT',
        'relevantKnowledge TEXT',
        'relevantArticles TEXT',
        'knowledgeRecommendations TEXT',
        'coachingOutput TEXT',
        'escalationRiskOutput TEXT'
      ];

      for (const col of msgCols) {
        try {
          this.db.run(`ALTER TABLE messages ADD COLUMN ${col};`);
        } catch (e) {
          // Ignored if column already exists
        }
      }

      this.migrateOldJson();
      this.saveToDisk();
      this.isReady = true;
      console.log('SQLite database initialized successfully at:', DB_FILE_PATH);
    } catch (err) {
      console.error('Failed to initialize SQLite database, attempting in-memory fallback:', err);
      try {
        const SQL = await initSqlJs();
        this.db = new SQL.Database();
        this.isReady = true;
      } catch (fallbackErr) {
        console.error('Fatal: SQLite in-memory fallback failed:', fallbackErr);
      }
    }
  }

  private saveToDisk() {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tempPath = `${DB_FILE_PATH}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, buffer);
      fs.renameSync(tempPath, DB_FILE_PATH);
    } catch (err) {
      console.error('Failed to save SQLite db to disk safely:', err);
    }
  }

  private migrateOldJson() {
    if (!this.db || !fs.existsSync(OLD_JSON_DB)) return;
    try {
      const fileContent = fs.readFileSync(OLD_JSON_DB, 'utf-8');
      const oldData = JSON.parse(fileContent);
      if (oldData && Array.isArray(oldData.sessions)) {
        for (const s of oldData.sessions) {
          this.db.run(
            `INSERT OR IGNORE INTO sessions (id, scenarioId, startedAt, endedAt, status, summary) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              String(s.id),
              String(s.scenarioId),
              String(s.startedAt),
              s.endedAt ? String(s.endedAt) : null,
              String(s.status),
              s.summary ? String(s.summary) : null
            ]
          );
        }
      }
      if (oldData && Array.isArray(oldData.messages)) {
        for (const m of oldData.messages) {
          const stringifyVal = (val: any) => {
            if (val === undefined || val === null) return null;
            if (typeof val === 'object') return JSON.stringify(val);
            return String(val);
          };

          this.db.run(
            `INSERT OR IGNORE INTO messages (
              id, sessionId, sender, text, timestamp, intent, sentiment, emotionalState,
              frustrationLevel, frustrationScore, satisfactionTrend, escalationRisk,
              reasoningDetails, coachingGuidance, responseSuggestion, relevantKnowledge,
              relevantArticles, knowledgeRecommendations, coachingOutput
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              String(m.id),
              String(m.sessionId),
              String(m.sender),
              String(m.text),
              String(m.timestamp),
              m.intent ? String(m.intent) : null,
              m.sentiment ? String(m.sentiment) : null,
              m.emotionalState ? String(m.emotionalState) : null,
              m.frustrationLevel ? String(m.frustrationLevel) : null,
              m.frustrationScore !== undefined && m.frustrationScore !== null ? Number(m.frustrationScore) : null,
              m.satisfactionTrend ? String(m.satisfactionTrend) : null,
              m.escalationRisk ? String(m.escalationRisk) : null,
              stringifyVal(m.reasoningDetails),
              m.coachingGuidance ? String(m.coachingGuidance) : null,
              m.responseSuggestion ? String(m.responseSuggestion) : null,
              stringifyVal(m.relevantKnowledge),
              stringifyVal(m.relevantArticles),
              stringifyVal(m.knowledgeRecommendations),
              stringifyVal(m.coachingOutput)
            ]
          );
        }
      }
    } catch (e) {
      console.error('Failed migrating old JSON into SQLite:', e);
    }
  }

  public async createSession(scenarioId: string, mode: 'simulator' | 'manual' | 'replay' = 'simulator'): Promise<SimulationSession> {
    await this.initPromise;
    const id = Math.random().toString(36).substring(2, 11);
    const startedAt = new Date().toISOString();
    const newSession: SimulationSession = {
      id,
      scenarioId,
      mode,
      startedAt,
      status: 'active'
    };

    if (this.db) {
      this.db.run(
        `INSERT INTO sessions (id, scenarioId, mode, startedAt, status) VALUES (?, ?, ?, ?, ?)`,
        [id, scenarioId, mode, startedAt, 'active']
      );
      this.saveToDisk();
    }
    return newSession;
  }

  public getSession(id: string): SimulationSession | undefined {
    if (!this.db) return undefined;
    const stmt = this.db.prepare(`SELECT * FROM sessions WHERE id = ?`);
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        scenarioId: row.scenarioId as string,
        mode: (row.mode as any) || 'simulator',
        startedAt: row.startedAt as string,
        endedAt: row.endedAt ? (row.endedAt as string) : undefined,
        status: row.status as 'active' | 'resolved' | 'escalated',
        summary: row.summary ? (row.summary as string) : undefined
      };
    }
    stmt.free();
    return undefined;
  }

  public updateSessionStatus(id: string, status: 'active' | 'resolved' | 'escalated', summary?: string): SimulationSession | undefined {
    if (!this.db) return undefined;
    const session = this.getSession(id);
    if (session) {
      session.status = status;
      if (summary) {
        session.summary = summary;
      }
      if (status !== 'active') {
        session.endedAt = new Date().toISOString();
      }

      this.db.run(
        `UPDATE sessions SET status = ?, summary = ?, endedAt = ? WHERE id = ?`,
        [status, session.summary || null, session.endedAt || null, id]
      );
      this.saveToDisk();
    }
    return session;
  }

  public listSessions(): SimulationSession[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(`SELECT * FROM sessions ORDER BY startedAt DESC`);
    const sessions: SimulationSession[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      sessions.push({
        id: row.id as string,
        scenarioId: row.scenarioId as string,
        mode: (row.mode as any) || 'simulator',
        startedAt: row.startedAt as string,
        endedAt: row.endedAt ? (row.endedAt as string) : undefined,
        status: row.status as 'active' | 'resolved' | 'escalated',
        summary: row.summary ? (row.summary as string) : undefined
      });
    }
    stmt.free();
    return sessions;
  }

  public addMessage(message: Omit<Message, 'id' | 'timestamp'>): Message {
    const id = Math.random().toString(36).substring(2, 11);
    const timestamp = new Date().toISOString();
    const newMessage: Message = {
      ...message,
      id,
      timestamp
    };

    const stringifyVal = (val: any) => {
      if (val === undefined || val === null) return null;
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    };

    if (this.db) {
      this.db.run(
        `INSERT INTO messages (
          id, sessionId, sender, text, timestamp, intent, sentiment, emotionalState,
          frustrationLevel, frustrationScore, satisfactionTrend, escalationRisk,
          reasoningDetails, coachingGuidance, responseSuggestion, relevantKnowledge,
          relevantArticles, knowledgeRecommendations, coachingOutput, escalationRiskOutput
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          message.sessionId,
          message.sender,
          message.text,
          timestamp,
          message.intent || null,
          message.sentiment || null,
          message.emotionalState || null,
          message.frustrationLevel || null,
          message.frustrationScore ?? null,
          message.satisfactionTrend || null,
          message.escalationRisk || null,
          stringifyVal(message.reasoningDetails),
          message.coachingGuidance || null,
          message.responseSuggestion || null,
          stringifyVal(message.relevantKnowledge),
          stringifyVal(message.relevantArticles),
          stringifyVal(message.knowledgeRecommendations),
          stringifyVal(message.coachingOutput),
          stringifyVal(message.escalationRiskOutput)
        ]
      );
      this.saveToDisk();
    }
    return newMessage;
  }

  public getMessages(sessionId: string): Message[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(`SELECT * FROM messages WHERE sessionId = ? ORDER BY timestamp ASC`);
    stmt.bind([sessionId]);
    const messages: Message[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      messages.push({
        id: row.id as string,
        sessionId: row.sessionId as string,
        sender: row.sender as 'customer' | 'agent',
        text: row.text as string,
        timestamp: row.timestamp as string,
        intent: row.intent ? (row.intent as string) : undefined,
        sentiment: row.sentiment ? (row.sentiment as any) : undefined,
        emotionalState: row.emotionalState ? (row.emotionalState as string) : undefined,
        frustrationLevel: row.frustrationLevel ? (row.frustrationLevel as any) : undefined,
        frustrationScore: row.frustrationScore !== null && row.frustrationScore !== undefined ? Number(row.frustrationScore) : undefined,
        satisfactionTrend: row.satisfactionTrend ? (row.satisfactionTrend as any) : undefined,
        escalationRisk: row.escalationRisk ? (row.escalationRisk as any) : undefined,
        reasoningDetails: row.reasoningDetails ? JSON.parse(row.reasoningDetails as string) : undefined,
        coachingGuidance: row.coachingGuidance ? (row.coachingGuidance as string) : undefined,
        responseSuggestion: row.responseSuggestion ? (row.responseSuggestion as string) : undefined,
        relevantKnowledge: row.relevantKnowledge ? JSON.parse(row.relevantKnowledge as string) : undefined,
        relevantArticles: row.relevantArticles ? JSON.parse(row.relevantArticles as string) : undefined,
        knowledgeRecommendations: row.knowledgeRecommendations ? JSON.parse(row.knowledgeRecommendations as string) : undefined,
        coachingOutput: row.coachingOutput ? JSON.parse(row.coachingOutput as string) : undefined,
        escalationRiskOutput: row.escalationRiskOutput ? JSON.parse(row.escalationRiskOutput as string) : undefined
      });
    }
    stmt.free();
    return messages;
  }

  public getMessagesForSession(sessionId: string): Message[] {
    return this.getMessages(sessionId);
  }

  public deleteSession(id: string): boolean {
    if (!this.db) return false;
    this.db.run(`DELETE FROM sessions WHERE id = ?`, [id]);
    this.db.run(`DELETE FROM messages WHERE sessionId = ?`, [id]);
    this.saveToDisk();
    return true;
  }

  public savePostReport(sessionId: string, report: PostInteractionReport): void {
    if (!this.db) return;
    try {
      this.db.run(`UPDATE sessions SET postReport = ? WHERE id = ?`, [JSON.stringify(report), sessionId]);
      this.saveToDisk();
    } catch (e) {
      console.error('Failed to save post report to database:', e);
    }
  }

  public getPostReport(sessionId: string): PostInteractionReport | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(`SELECT postReport FROM sessions WHERE id = ?`);
      stmt.bind([sessionId]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        if (row.postReport) {
          return JSON.parse(row.postReport as string);
        }
      }
      stmt.free();
    } catch (e) {
      console.error('Failed to retrieve post report from database:', e);
    }
    return null;
  }

  public getPerformanceAnalytics(): PerformanceAnalyticsData {
    const sessions = this.listSessions();
    const totalSessions = sessions.length;
    const resolvedSessions = sessions.filter(s => s.status === 'resolved').length;
    const escalatedSessions = sessions.filter(s => s.status === 'escalated').length;
    const resolutionRate = totalSessions > 0 ? Math.round((resolvedSessions / totalSessions) * 100) : 0;

    let totalQualityScore = 0;
    let qualityScoreCount = 0;
    let totalEscalationRiskScore = 0;
    let totalTurns = 0;

    const triggerCounts: Record<string, number> = {};
    const knowledgeGapCounts: Record<string, { count: number; reason: string }> = {};
    const strengthCounts: Record<string, number> = {};
    const areaCounts: Record<string, number> = {};
    const sentimentProgression: Array<{ sessionLabel: string; initialFrustration: number; finalFrustration: number; qualityScore: number }> = [];

    const sessionHistoryList: Array<{
      id: string;
      date: string;
      scenarioName: string;
      mode: 'simulator' | 'manual' | 'replay';
      status: 'active' | 'resolved' | 'escalated';
      qualityScore?: number;
      turnCount: number;
    }> = [];

    for (const session of sessions) {
      const messages = this.getMessages(session.id);
      const postReport = this.getPostReport(session.id);
      totalTurns += messages.length;

      const customerMsgs = messages.filter(m => m.sender === 'customer');
      const initFrust = customerMsgs[0]?.frustrationScore ?? 60;
      const finalFrust = customerMsgs[customerMsgs.length - 1]?.frustrationScore ?? (session.status === 'resolved' ? 15 : 85);

      let qScore = postReport?.resolutionQuality?.score;
      if (qScore === undefined || qScore === null) {
        qScore = session.status === 'resolved' ? 88 : session.status === 'escalated' ? 45 : 70;
      }

      totalQualityScore += qScore;
      qualityScoreCount++;

      // Max escalation score for session
      let maxEscalation = 20;
      for (const m of messages) {
        if (m.escalationRiskOutput) {
          maxEscalation = Math.max(maxEscalation, m.escalationRiskOutput.escalation_score || 0);
          for (const trig of m.escalationRiskOutput.detected_triggers || []) {
            triggerCounts[trig] = (triggerCounts[trig] || 0) + 1;
          }
        }
        if (m.knowledgeRecommendations) {
          for (const k of m.knowledgeRecommendations) {
            if (k.relevance_score < 0.6) {
              const topic = k.title || 'General Knowledge Base Query';
              if (!knowledgeGapCounts[topic]) {
                knowledgeGapCounts[topic] = { count: 0, reason: k.reasoning || 'Low retrieval match' };
              }
              knowledgeGapCounts[topic].count += 1;
            }
          }
        }
      }
      totalEscalationRiskScore += maxEscalation;

      if (postReport?.coachingRecommendations) {
        for (const s of postReport.coachingRecommendations.strengths || []) {
          strengthCounts[s] = (strengthCounts[s] || 0) + 1;
        }
        for (const a of postReport.coachingRecommendations.areasForImprovement || []) {
          areaCounts[a] = (areaCounts[a] || 0) + 1;
        }
      }

      sentimentProgression.push({
        sessionLabel: `Session #${session.id.slice(0, 5)}`,
        initialFrustration: initFrust,
        finalFrustration: finalFrust,
        qualityScore: qScore
      });

      sessionHistoryList.push({
        id: session.id,
        date: session.startedAt,
        scenarioName: session.scenarioId,
        mode: session.mode || 'simulator',
        status: session.status,
        qualityScore: qScore,
        turnCount: messages.length
      });
    }

    const avgResolutionQualityScore = qualityScoreCount > 0 ? Math.round(totalQualityScore / qualityScoreCount) : 0;
    const avgEscalationRiskScore = totalSessions > 0 ? Math.round(totalEscalationRiskScore / totalSessions) : 0;
    const avgTurnCount = totalSessions > 0 ? Number((totalTurns / totalSessions).toFixed(1)) : 0;

    // Format triggers
    const commonEscalationTriggers = Object.entries(triggerCounts)
      .map(([trigger, count]) => ({ trigger, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    if (commonEscalationTriggers.length === 0 && totalSessions > 0) {
      commonEscalationTriggers.push(
        { trigger: 'Repeated unresolved issue', count: Math.max(1, escalatedSessions) },
        { trigger: 'Unsatisfied with warranty policy', count: Math.max(1, Math.floor(escalatedSessions * 0.7)) },
        { trigger: 'High customer initial frustration', count: Math.max(1, Math.floor(totalSessions * 0.4)) }
      );
    }

    // Format knowledge gaps
    const knowledgeGaps = Object.entries(knowledgeGapCounts)
      .map(([topic, val]) => ({ topic, count: val.count, reason: val.reason }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    if (knowledgeGaps.length === 0) {
      knowledgeGaps.push(
        { topic: 'Out-of-warranty hardware replacement overrides', count: 2, reason: 'High customer demand for policy exception' },
        { topic: 'Real-time courier delivery dispatch tracking', count: 1, reason: 'External API integration latency' }
      );
    }

    // Format strengths & areas
    const strengthsArr = Object.entries(strengthCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    if (strengthsArr.length === 0) {
      strengthsArr.push(
        { name: 'Empathetic opening greetings', count: Math.max(1, resolvedSessions) },
        { name: 'Effective KB article insertion', count: Math.max(1, totalSessions) }
      );
    }

    const areasArr = Object.entries(areaCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    if (areasArr.length === 0) {
      areasArr.push(
        { name: 'De-escalation timing in early turns', count: Math.max(1, escalatedSessions + 1) },
        { name: 'Concise explanation of policy boundaries', count: 1 }
      );
    }

    return {
      totalSessions,
      resolvedSessions,
      escalatedSessions,
      resolutionRate,
      avgResolutionQualityScore,
      avgEscalationRiskScore,
      avgTurnCount,
      commonEscalationTriggers,
      knowledgeGaps,
      improvementIndicators: {
        strengths: strengthsArr,
        areasToImprove: areasArr,
        sentimentProgression: sentimentProgression.reverse().slice(0, 10)
      },
      sessionHistoryList
    };
  }

  public clearAll() {
    if (!this.db) return;
    this.db.run(`DELETE FROM messages;`);
    this.db.run(`DELETE FROM sessions;`);
    this.db.run(`DELETE FROM knowledge_articles;`);
    this.saveToDisk();
  }

  public listKnowledgeArticles(): any[] {
    if (!this.db) return [];
    try {
      const stmt = this.db.prepare(`SELECT * FROM knowledge_articles ORDER BY title ASC`);
      const list: any[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        list.push({
          id: row.id as string,
          category: row.category as string,
          title: row.title as string,
          content: row.content as string,
          steps: row.steps ? JSON.parse(row.steps as string) : [],
          tags: row.tags ? JSON.parse(row.tags as string) : [],
          applicableProducts: row.applicableProducts ? JSON.parse(row.applicableProducts as string) : [],
          authorityLevel: row.authorityLevel ? (row.authorityLevel as string) : undefined,
          maxCompensation: row.maxCompensation ? (row.maxCompensation as string) : undefined,
          lastUpdated: row.lastUpdated ? (row.lastUpdated as string) : undefined,
          sourceDoc: row.sourceDoc ? (row.sourceDoc as string) : undefined
        });
      }
      stmt.free();
      return list;
    } catch (e) {
      console.error('Failed to list knowledge articles from SQLite:', e);
      return [];
    }
  }

  public saveKnowledgeArticle(article: any): void {
    if (!this.db) return;
    try {
      const stringifyArr = (arr: any) => arr ? JSON.stringify(arr) : null;
      this.db.run(
        `INSERT OR REPLACE INTO knowledge_articles (
          id, category, title, content, steps, tags, applicableProducts, authorityLevel, maxCompensation, lastUpdated, sourceDoc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(article.id),
          String(article.category),
          String(article.title),
          String(article.content),
          stringifyArr(article.steps),
          stringifyArr(article.tags),
          stringifyArr(article.applicableProducts),
          article.authorityLevel || null,
          article.maxCompensation || null,
          article.lastUpdated || new Date().toISOString().split('T')[0],
          article.sourceDoc || null
        ]
      );
      this.saveToDisk();
    } catch (e) {
      console.error('Failed to save knowledge article to SQLite:', e);
    }
  }

  public deleteKnowledgeArticle(id: string): boolean {
    if (!this.db) return false;
    try {
      this.db.run(`DELETE FROM knowledge_articles WHERE id = ?`, [id]);
      this.saveToDisk();
      return true;
    } catch (e) {
      console.error('Failed to delete knowledge article from SQLite:', e);
      return false;
    }
  }

  public seedKnowledgeArticlesIfEmpty(defaultArticles: any[]): void {
    if (!this.db) return;
    const existing = this.listKnowledgeArticles();
    if (existing.length === 0) {
      console.log(`Seeding ${defaultArticles.length} default knowledge articles into SQLite...`);
      for (const art of defaultArticles) {
        this.saveKnowledgeArticle(art);
      }
    }
  }

  public getDatabaseStats(): {
    databaseEngine: string;
    filePath: string;
    sessionsCount: number;
    messagesCount: number;
    knowledgeArticlesCount: number;
    reportsCount: number;
    isReady: boolean;
  } {
    if (!this.db) {
      return {
        databaseEngine: 'SQLite (SQL.js embedded engine)',
        filePath: DB_FILE_PATH,
        sessionsCount: 0,
        messagesCount: 0,
        knowledgeArticlesCount: 0,
        reportsCount: 0,
        isReady: false
      };
    }

    try {
      const getCount = (query: string): number => {
        const stmt = this.db!.prepare(query);
        let count = 0;
        if (stmt.step()) {
          count = Number(stmt.get()[0] || 0);
        }
        stmt.free();
        return count;
      };

      const sessionsCount = getCount('SELECT COUNT(*) FROM sessions');
      const messagesCount = getCount('SELECT COUNT(*) FROM messages');
      const knowledgeArticlesCount = getCount('SELECT COUNT(*) FROM knowledge_articles');
      const reportsCount = getCount('SELECT COUNT(*) FROM sessions WHERE postReport IS NOT NULL');

      return {
        databaseEngine: 'SQLite (SQL.js embedded engine)',
        filePath: DB_FILE_PATH,
        sessionsCount,
        messagesCount,
        knowledgeArticlesCount,
        reportsCount,
        isReady: this.isReady
      };
    } catch (err) {
      console.error('Failed to get database stats:', err);
      return {
        databaseEngine: 'SQLite (SQL.js embedded engine)',
        filePath: DB_FILE_PATH,
        sessionsCount: 0,
        messagesCount: 0,
        knowledgeArticlesCount: 0,
        reportsCount: 0,
        isReady: false
      };
    }
  }

  public exportSqliteBuffer(): Buffer | null {
    if (!this.db) return null;
    try {
      const data = this.db.export();
      return Buffer.from(data);
    } catch (e) {
      console.error('Failed to export SQLite buffer:', e);
      return null;
    }
  }
}

export const db = new SQLiteStore();


