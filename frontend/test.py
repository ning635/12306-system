import random
import json

# 定义基础数据池：城市及对应的站点
city_stations = {
    # 一线城市及核心枢纽
    "北京": ["北京南", "北京西", "北京东", "北京站"],
    "上海": ["上海虹桥", "上海站", "上海南", "上海西"],
    "广州": ["广州南", "广州东", "广州北", "广州白云"],
    "深圳": ["深圳北", "深圳东", "深圳机场", "深圳宝安机场", "深圳南"],
    "成都": ["成都东", "成都南", "成都西", "成都天府"],
    "重庆": ["重庆北", "重庆西", "重庆南", "重庆江北机场"],
    "杭州": ["杭州东", "杭州西", "杭州南", "杭州站"],
    "南京": ["南京南", "南京站", "南京西", "南京禄口机场"],
    "武汉": ["武汉站", "武汉汉口", "武汉武昌", "武汉天河机场"],
    "西安": ["西安北", "西安站", "西安东", "西安咸阳机场"],
    # 新一线城市
    "郑州": ["郑州东", "郑州西", "郑州站", "郑州航空港"],
    "长沙": ["长沙南", "长沙站", "长沙西", "长沙黄花机场"],
    "青岛": ["青岛北", "青岛站", "青岛西", "青岛胶东机场"],
    "苏州": ["苏州北", "苏州站", "苏州园区", "苏州新区"],
    "宁波": ["宁波站", "宁波东", "宁波西", "宁波栎社机场"],
    "无锡": ["无锡东", "无锡站", "无锡新区", "无锡惠山"],
    "厦门": ["厦门北", "厦门站", "厦门高崎", "厦门翔安机场"],
    "合肥": ["合肥南", "合肥站", "合肥西", "合肥新桥机场"],
    "佛山": ["佛山西", "佛山站", "佛山顺德", "佛山三水"],
    "东莞": ["东莞南", "东莞站", "东莞东", "东莞虎门"]
}

# 提取所有城市列表
cities = list(city_stations.keys())

def get_random_time():
    """生成随机发车时间，95%为5:00-23:00，5%为0:00-4:00"""
    if random.random() < 0.95:
        hour = random.randint(5, 23)  # 非凌晨时段
    else:
        hour = random.randint(0, 4)   # 凌晨时段（仅5%概率）
    minute = random.randint(0, 59)
    return f"{hour:02d}:{minute:02d}"

def calculate_end_time(start_time, duration_hours):
    """根据出发时间和时长计算到达时间，处理跨天情况"""
    start_hour, start_min = map(int, start_time.split(":"))
    total_minutes = start_hour * 60 + start_min + int(duration_hours * 60)
    
    end_hour = total_minutes // 60
    end_min = total_minutes % 60
    is_next_day = end_hour >= 24
    
    if is_next_day:
        end_hour -= 24
        return f"{end_hour:02d}:{end_min:02d}(次日)"
    return f"{end_hour:02d}:{end_min:02d}"

def get_duration_desc(hours):
    """生成时长描述，例如 7.83小时 → 7小时50分"""
    int_hours = int(hours)
    minutes = round((hours - int_hours) * 60)
    if int_hours == 0:
        return f"{minutes}分钟"
    elif minutes == 0:
        return f"{int_hours}小时"
    else:
        return f"{int_hours}小时{minutes}分"

def get_random_price(min_price, max_price, is_first_class=False):
    """生成随机整数票价，一等座约为二等座的1.5-1.6倍"""
    # 生成整数基础票价
    base_price = random.randint(int(min_price), int(max_price))
    if is_first_class:
        # 一等座价格：基础票价 * 1.5-1.6倍后取整
        first_price = round(base_price * (1.5 + random.uniform(0, 0.1)))
        return str(first_price)
    # 二等座直接返回整数的字符串形式
    return str(base_price)

def get_seat_availability():
    """生成座位余量：新增一等座余票、无座是否有票（1有/0无）"""
    # 二等座余票：0-30随机
    second = random.randint(0, 30)
    # 一等座余票：通常少于二等座，0-15随机
    first = random.randint(0, 15)
    # 无座是否有票：70%概率有票（1），30%无票（0）
    noSeat = 1 if random.random() < 0.7 else 0
    return {
        "second": second,
        "first": first,
        "noSeat": noSeat
    }

def generate_train_number(index):
    """生成车次编号，例如 G0001、D0012"""
    prefixes = ["G", "D", "C", "Z", "T", "K"]
    prefix = random.choice(prefixes)
    return f"{prefix}{index + 1:04d}"

def generate_train_data(count=150):
    """生成指定数量的列车数据，返回列表"""
    train_data = []
    for i in range(count):
        # 随机选择出发/到达城市（确保不同）
        start_city = random.choice(cities)
        end_city = random.choice(cities)
        while start_city == end_city:
            end_city = random.choice(cities)
        
        # 随机选择具体站点
        start_station = random.choice(city_stations[start_city])
        end_station = random.choice(city_stations[end_city])
        
        # 生成时间/时长/票价等数据
        start_time = get_random_time()
        duration_hours = 0.5 + random.random() * 11.5
        duration = get_duration_desc(duration_hours)
        end_time = calculate_end_time(start_time, duration_hours)
        
        # 按行程时长划分票价区间
        if duration_hours < 1:
            min_p, max_p = 20, 80
        elif duration_hours < 3:
            min_p, max_p = 100, 200
        elif duration_hours < 6:
            min_p, max_p = 300, 600
        else:
            min_p, max_p = 500, 900
        
        second_seat_price = get_random_price(min_p, max_p)
        first_seat_price = get_random_price(min_p, max_p, is_first_class=True)
        
        # 组装单条车次数据
        train_item = {
            "number": generate_train_number(i),
            "startStation": start_station,
            "endStation": end_station,
            "startTime": start_time,
            "endTime": end_time,
            "duration": duration,
            "secondSeatPrice": second_seat_price,
            "firstSeatPrice": first_seat_price,
            "seatAvailability": get_seat_availability()
        }
        train_data.append(train_item)
    return train_data

# 主程序执行
if __name__ == "__main__":
    # 生成150条车次数据
    train_data = generate_train_data(150)
    
    # 逐行写入文件（前149行末尾加逗号，最后一行不加）
    with open("train_data_150_lines_full_seat.json", "w", encoding="utf-8") as f:
        for idx, train_item in enumerate(train_data):
            # 每个车次转为单行JSON字符串
            line = json.dumps(train_item, ensure_ascii=False)
            # 前149行末尾加逗号+换行，最后一行只加换行
            if idx < len(train_data) - 1:
                line += ",\n"
            else:
                line += "\n"
            f.write(line)
    
    # 打印前3条数据预览（验证新增字段）
    print("生成的数据预览（前3行，含一等座余票+无座标识）：")
    for i in range(3):
        preview_line = json.dumps(train_data[i], ensure_ascii=False)
        if i < 2:
            print(preview_line + ",")
        else:
            print(preview_line)
    
    print(f"\n已生成{len(train_data)}条车次数据，含一等座余票、无座是否有票标识，已存入 train_data_150_lines_full_seat.json 文件")