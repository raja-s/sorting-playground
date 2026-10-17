from random import shuffle

values = [3, 7, 1, 5, 2, 8, 9, 4, 6] #l#

n = len(values) #t#

def list_is_sorted():
    for i in range(n - 1): #tv#
        if values[i] > values[i + 1]:
            return False
    return True

while not list_is_sorted():
    shuffle(values)
