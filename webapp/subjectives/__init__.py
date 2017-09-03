# coding= utf-8
import yaml

def getDurationSubjective(duration):
    return getSubjective(duration, 'subjectives/duration.yaml')

def getHateSubjective(hate):
    return getSubjective(hate, 'subjectives/hate.yaml')

def getSubjective(value, file):
    f = open(file, 'r', encoding='utf-8')
    data = yaml.load(f.read())
    data = sorted(data, key=lambda x: x['min'])
    for item in data:
        if value >= item['min'] and value <= item['max']:
            return item['text']
    return 'Uau! Fora da escala! Isso é bom?'
