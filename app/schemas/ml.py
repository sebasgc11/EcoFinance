from pydantic import BaseModel

class ClusterUserOut(BaseModel):
    user_id: int
    cluster: int