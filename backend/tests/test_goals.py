"""Vaultra DigiGold - Gold Goals API tests."""
import os, uuid, pytest, requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://vaultra-gold.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _login(sess, phone):
    r = sess.post(f"{API}/auth/otp/request", json={"phone": phone}).json()
    r2 = sess.post(f"{API}/auth/otp/verify",
                   json={"challenge_id": r["challenge_id"], "otp": r["demo_otp"],
                         "tenant": "vaultra", "name": "Goals Tester"})
    data = r2.json()
    return {"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"}, data["user"]


# ---- unauthenticated ----
class TestGoalsAuth:
    def test_list_requires_auth(self, s):
        r = s.get(f"{API}/goals")
        assert r.status_code in (401, 403)

    def test_create_requires_auth(self, s):
        r = s.post(f"{API}/goals", json={"name": "x", "target_grams": 1, "months": 3})
        assert r.status_code in (401, 403)

    def test_delete_requires_auth(self, s):
        r = s.delete(f"{API}/goals/nope")
        assert r.status_code in (401, 403)


# ---- crud + limits ----
class TestGoalsCRUD:
    @pytest.fixture(autouse=True)
    def setup(self, s):
        phone = f"9000{str(uuid.uuid4().int)[-6:]}"
        self.auth, self.user = _login(s, phone)
        self.s = s

    def test_initial_empty_then_create(self):
        before = self.s.get(f"{API}/goals", headers=self.auth)
        assert before.status_code == 200 and before.json() == []

        payload = {"name": "Diwali Fund", "occasion": "diwali", "target_grams": 5.0, "months": 6}
        r = self.s.post(f"{API}/goals", headers=self.auth, json=payload)
        assert r.status_code == 200, r.text
        g = r.json()
        assert g["name"] == "Diwali Fund"
        assert g["occasion"] == "diwali"
        assert g["target_grams"] == 5.0
        assert g["months"] == 6
        assert "id" in g and "deadline" in g and "start_grams" in g

        # verify persistence
        lst = self.s.get(f"{API}/goals", headers=self.auth).json()
        assert any(x["id"] == g["id"] for x in lst)

    def test_validation_target_zero_422(self):
        r = self.s.post(f"{API}/goals", headers=self.auth,
                        json={"name": "Bad", "target_grams": 0, "months": 3})
        assert r.status_code == 422

    def test_validation_months_zero_422(self):
        r = self.s.post(f"{API}/goals", headers=self.auth,
                        json={"name": "Bad", "target_grams": 1, "months": 0})
        assert r.status_code == 422

    def test_validation_short_name_422(self):
        r = self.s.post(f"{API}/goals", headers=self.auth,
                        json={"name": "a", "target_grams": 1, "months": 3})
        assert r.status_code == 422

    def test_max_five_goals_400(self):
        # create 5 goals (one already exists from test_initial? no — each test gets fresh user)
        for i in range(5):
            r = self.s.post(f"{API}/goals", headers=self.auth,
                            json={"name": f"Goal {i}", "target_grams": 1.0 + i, "months": 6})
            assert r.status_code == 200, r.text
        # 6th should fail
        r6 = self.s.post(f"{API}/goals", headers=self.auth,
                         json={"name": "Overflow", "target_grams": 1, "months": 3})
        assert r6.status_code == 400
        assert "5" in r6.text or "up to" in r6.text.lower()

    def test_delete_unknown_404(self):
        r = self.s.delete(f"{API}/goals/{uuid.uuid4()}", headers=self.auth)
        assert r.status_code == 404

    def test_delete_removes_goal(self):
        g = self.s.post(f"{API}/goals", headers=self.auth,
                        json={"name": "ToDelete", "target_grams": 2, "months": 4}).json()
        d = self.s.delete(f"{API}/goals/{g['id']}", headers=self.auth)
        assert d.status_code == 200 and d.json().get("ok") is True
        lst = self.s.get(f"{API}/goals", headers=self.auth).json()
        assert not any(x["id"] == g["id"] for x in lst)

    def test_delete_is_scoped_to_user(self, s):
        # create goal as user A
        g = self.s.post(f"{API}/goals", headers=self.auth,
                        json={"name": "UserA", "target_grams": 3, "months": 5}).json()
        # login as fresh user B
        phoneB = f"9000{str(uuid.uuid4().int)[-6:]}"
        auth_b, _ = _login(s, phoneB)
        # user B tries to delete A's goal
        r = s.delete(f"{API}/goals/{g['id']}", headers=auth_b)
        assert r.status_code == 404
