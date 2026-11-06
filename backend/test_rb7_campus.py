"""Run the shared RB7 campus cases without a database or external test package."""
import json
from pathlib import Path
import unittest

from rb7 import is_main_campus_room, rb7_teaching_exam_violation


CASES_PATH = Path(__file__).resolve().parents[1] / "database" / "rb7_campus_test_cases.json"


class RB7CampusCases(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cases = json.loads(CASES_PATH.read_text(encoding="utf-8"))

    def test_shared_cases_match_campus_and_constraint_expectations(self):
        self.assertGreaterEqual(len(self.cases), 6)
        for case in self.cases:
            with self.subTest(case_id=case["caseId"]):
                expected_main = case["expectedMain"]
                actual_main = is_main_campus_room(case["room"])
                self.assertIs(actual_main, expected_main)

                actual_rb7 = rb7_teaching_exam_violation(
                    case["room"],
                    case["teachStart"],
                    case["teachEnd"],
                    case["examStart"],
                    case["examEnd"],
                )
                self.assertEqual(actual_rb7, case["expectedRB7"])

                actual_rb4 = (
                    case["teachStart"] <= case["examEnd"]
                    and case["examStart"] <= case["teachEnd"]
                )
                self.assertEqual(actual_rb4, case["expectedRB4"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
