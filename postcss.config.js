const postcss = require("postcss");

const subjectAnalysisLayoutFix = {
  postcssPlugin: "classpulse-subject-analysis-layout-fix",
  Once(root) {
    root.append(
      postcss.parse(`
        /* Subject Analysis / Midsem Combined layout overrides */
        .combined-tier-panel { display: none !important; }

        .combined-layout {
          grid-template-columns: minmax(0, 1.75fr) minmax(300px, .75fr) !important;
          min-width: 0 !important;
        }

        .combined-table-panel,
        .combined-table-wrap {
          min-width: 0 !important;
        }

        .combined-table-wrap {
          overflow-x: hidden !important;
          overflow-y: auto !important;
        }

        .combined-table-panel .analysis-table {
          width: 100% !important;
          min-width: 0 !important;
          table-layout: fixed !important;
        }

        .combined-table-panel .analysis-table th,
        .combined-table-panel .analysis-table td {
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        /* The old column allocation added up to 110%, forcing horizontal scroll. */
        .combined-table-panel .analysis-table th:nth-child(1),
        .combined-table-panel .analysis-table td:nth-child(1) { width: 7% !important; }
        .combined-table-panel .analysis-table th:nth-child(2),
        .combined-table-panel .analysis-table td:nth-child(2) { width: 23% !important; }
        .combined-table-panel .analysis-table th:nth-child(3),
        .combined-table-panel .analysis-table td:nth-child(3) { width: 15% !important; }
        .combined-table-panel .analysis-table th:nth-child(4),
        .combined-table-panel .analysis-table td:nth-child(4),
        .combined-table-panel .analysis-table th:nth-child(5),
        .combined-table-panel .analysis-table td:nth-child(5),
        .combined-table-panel .analysis-table th:nth-child(6),
        .combined-table-panel .analysis-table td:nth-child(6),
        .combined-table-panel .analysis-table th:nth-child(7),
        .combined-table-panel .analysis-table td:nth-child(7) { width: 10% !important; }
        .combined-table-panel .analysis-table th:nth-child(8),
        .combined-table-panel .analysis-table td:nth-child(8) { width: 5% !important; }

        /* Keep the existing two sort controls, but visually place them in the table panel header area. */
        .combined-controls-bar {
          position: relative !important;
          z-index: 5 !important;
          margin: 0 0 -74px !important;
          padding: 0 18px 12px 18px !important;
          transform: translateY(74px) !important;
          padding-right: calc(30% + 24px) !important;
          pointer-events: none !important;
        }

        .combined-controls-bar .combined-control {
          pointer-events: auto !important;
          min-width: 165px !important;
        }

        .combined-table-panel {
          padding-top: 86px !important;
        }

        @media (max-width: 1200px) {
          .combined-layout {
            grid-template-columns: 1fr !important;
          }

          .combined-controls-bar {
            margin: 0 0 18px !important;
            padding: 0 !important;
            transform: none !important;
          }

          .combined-table-panel {
            padding-top: 18px !important;
          }
        }

        @media (max-width: 800px) {
          .combined-controls-bar {
            flex-direction: column !important;
            align-items: stretch !important;
          }
        }
      `)
    );
  },
};

module.exports = {
  plugins: [
    require("tailwindcss")(),
    require("autoprefixer")(),
    subjectAnalysisLayoutFix,
  ],
};

subjectAnalysisLayoutFix.postcss = true;
