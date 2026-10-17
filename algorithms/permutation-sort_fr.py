from random import shuffle

valeurs = [3, 7, 1, 5, 2, 8, 9, 4, 6] #l#

n = len(valeurs) #t#

def liste_est_triee():
    for i in range(n - 1): #tv#
        if valeurs[i] > valeurs[i + 1]:
            return False
    return True

while not liste_est_triee():
    shuffle(valeurs)
