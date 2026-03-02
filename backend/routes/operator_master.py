from fastapi import APIRouter
from backend.models import OperatorMasterItem

router = APIRouter(prefix="/api/operators", tags=["operators"])

OPERATOR_MASTER = [
    OperatorMasterItem(name='Ashwini', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Rebello', pan='AABCR1234A', gstRate='No GST', vehicles=['MH04LQ2670', 'MH02FX0793', 'MH02FX0794', 'MH47BR4849', 'DD01AA9972']),
    OperatorMasterItem(name='Nishnai', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Siddhant Travels', pan='EEMPS2345F', gstRate='18%', vehicles=['DD01Y9477', 'DD01Y9480']),
    OperatorMasterItem(name='Citycircle', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Shabnam Travels', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Cityline', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Grey Heron', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Indian Travels', pan='GGOPI1234H', gstRate='5%', vehicles=['DD01Y9580', 'DD01R9500', 'DD01J9696']),
    OperatorMasterItem(name='Surya Travels', pan='FFNPS6789G', gstRate='5%', vehicles=['MH43BX5349', 'MH43BX5350']),
    OperatorMasterItem(name='Dwarikamai', pan='HHQPD5678J', gstRate='No GST', vehicles=['MH02GH6877']),
    OperatorMasterItem(name='Sumedha', pan='JJSPS3456L', gstRate='18%', vehicles=['MH46CU5248']),
    OperatorMasterItem(name='Buthello', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Rizwan Travels', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Tanjai Travels', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Shree Sai Travels', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Swami', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='GHAPL', pan='AADCG5678B', gstRate='No GST', vehicles=['MH04LE2927', 'MH04LE2309', 'MH04LE2312', 'MH04LE2931']),
    OperatorMasterItem(name='Ajara Travels', pan='IIRPA9012K', gstRate='18%', vehicles=['MH01EM9799', 'MH47BY2861']),
    OperatorMasterItem(name='Nilesh Amberkar', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Sankalp', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Raj Travels', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Shabana', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Lata Tours', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Fortpoint', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Datta Travels', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='JP Naidu', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Bharti Travels', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Nityashree', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Amruta Travels', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Anusaya Tours & Travels', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Alif Tours & Travels', pan='', gstRate='No GST', vehicles=[]),
    OperatorMasterItem(name='Rafiq', pan='', gstRate='No GST', vehicles=[]),
]


@router.get("/master", response_model=list[OperatorMasterItem])
async def get_operator_master():
    return OPERATOR_MASTER
