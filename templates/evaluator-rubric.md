# Evaluator Rubric

Score each completed sprint against this rubric. Every dimension must reach grade B or above (Score >= 80%).

## Scoring Dimensions

| Dimension | Weight | Grade A (90-100%) | Grade B (80-89%) | Grade C (70-79%) | Grade D (<70%) |
|-----------|--------|-------------------|------------------|------------------|----------------|
| **1. Correctness** | 25% | All acceptance criteria satisfied; edge cases handled gracefully. | Core behavior working; minor non-blocking edge cases remain. | Partially working; missing acceptance criteria. | Broken functionality or runtime errors. |
| **2. Architectural Compliance** | 20% | Layer boundaries preserved; zero violations in `make check-arch`. | Minor style issue; no cross-layer leaks. | Direct DB call or bypass of service layer. | Severe boundary breach or security risk. |
| **3. Test Coverage & Quality** | 20% | High-quality unit and feature tests covering happy and failure paths. | Tests cover happy path and primary errors. | Fragile or incomplete test assertions. | Tests missing or failing. |
| **4. Verification Evidence** | 20% | All 3 layers verified with recorded command output and commit hash. | Layers verified; evidence briefly documented. | Incomplete evidence; skipped verification layer. | No verification evidence recorded. |
| **5. Clean State & Maintainability** | 15% | Zero debug artifacts; `make clean-check` passes; docs updated. | Clean state verified; docs minimally updated. | Leftover debug artifacts or stale comments. | Broken build or dirty working tree. |

## Sprint Evaluation Summary
- **Overall Grade**: [A / B / C / D]
- **Approval Verdict**: [Approved / Revision Required / Rejected]
- **Reviewer**: [Coordinator / Agent / Human Evaluator]
- **Notes & Required Follow-Ups**:
