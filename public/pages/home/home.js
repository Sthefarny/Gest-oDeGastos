function logout() {
    firebase.auth().signOut().then(() => {
        window.location.href = "../../index.html";
    }).catch(() => {
        alert('Erro ao fazer logout');
    })
}

firebase.auth().onAuthStateChanged(user => {
    if (user){
        findTransactions(user);
    }
})

function newTransaction() {
    window.location.href = "../transaction/transaction.html";
}

function findTransactions(user) {
    showLoading();
    firebase.firestore()
        .collection('transactions')
        .where('user.uid', '==', user.uid)
        .orderBy('date', 'desc')
        .get()
        .then(snapshot => {
            hideLoading();
            const transactions = snapshot.docs.map(doc => ({
                ...doc.data(),
                uid: doc.id
            }));
            addTransactionsToScreen(transactions);
        })
        .catch(error => {
            hideLoading();
            console.log(error);
            alert('Erro ao recuperar transacoes');
        })
}

// function addTransactionsToScreen(transactions) {
//     const orderedList = document.getElementById('transactions');

//     transactions.forEach(transaction => {
//         const li = document.createElement('li');
//         li.classList.add(transaction.type);
//         li.id = transaction.uid;
//         li.addEventListener('click', () => {
//             window.location.href = "../transaction/transaction.html?uid=" + transaction.uid;
//         })

//         const deleteButton = document.createElement('button');
//         deleteButton.innerHTML = "Remover";
//         deleteButton.classList.add('outline', 'danger');
//         deleteButton.addEventListener('click', event => {
//             event.stopPropagation();
//             askRemoveTransaction(transaction);
//         })
//         li.appendChild(deleteButton);

//         const date = document.createElement('p');
//         date.innerHTML = formatDate(transaction.date);
//         li.appendChild(date);

//         const money = document.createElement('p');
//         money.innerHTML = formatMoney(transaction.money);
//         li.appendChild(money);

//         const type = document.createElement('p');
//         type.innerHTML = transaction.transactionType;
//         li.appendChild(type);

//         if (transaction.description) {
//             const description = document.createElement('p');
//             description.innerHTML = transaction.description;
//             li.appendChild(description);
//         }

//         orderedList.appendChild(li);
//     });
// }
function addTransactionsToScreen(transactions) {
  const orderedList = document.getElementById('transactions');
  orderedList.innerHTML = ''; // limpa antes de adicionar

  transactions.forEach(transaction => {
      const li = document.createElement('li');
      li.classList.add(transaction.type); // 'income' ou 'expense'
      li.classList.add('transaction-item'); // usada para animação
      li.id = transaction.uid;

      li.addEventListener('click', () => {
          window.location.href = "../transaction/transaction.html?uid=" + transaction.uid;
      });

      const deleteButton = document.createElement('button');
      deleteButton.innerHTML = "Remover";
      deleteButton.classList.add('outline', 'danger');
      deleteButton.addEventListener('click', event => {
          event.stopPropagation();
          askRemoveTransaction(transaction);
      });

      const date = document.createElement('p');
      date.innerHTML = formatDate(transaction.date);

      const money = document.createElement('p');
      money.innerHTML = formatMoney(transaction.money);

      const type = document.createElement('p');
      type.innerHTML = transaction.transactionType;

      li.appendChild(deleteButton);
      li.appendChild(date);
      li.appendChild(money);
      li.appendChild(type);

      if (transaction.description) {
          const description = document.createElement('p');
          description.innerHTML = transaction.description;
          li.appendChild(description);
      }

      // Adiciona com animação de entrada
      orderedList.appendChild(li);
  });
}


function askRemoveTransaction(transaction) {
    const shouldRemove = confirm('Deseja remover a transaçao?');
    if (shouldRemove) {
        removeTransaction(transaction);
    }
}

function removeTransaction(transaction) {
  showLoading();

  firebase.firestore()
      .collection("transactions")
      .doc(transaction.uid)
      .delete()
      .then(() => {
          hideLoading();

          const li = document.getElementById(transaction.uid);
          if (li) {
              li.classList.add('removing'); // ativa animação
              setTimeout(() => {
                  li.remove();
              }, 300); // tempo deve bater com o CSS
          }
      })
      .catch(error => {
          hideLoading();
          console.log(error);
          alert('Erro ao remover transaçao');
      });
}

// function removeTransaction(transaction) {
//     showLoading();

//     firebase.firestore()
//         .collection("transactions")
//         .doc(transaction.uid)
//         .delete()
//         .then(() => {
//             hideLoading();
//             document.getElementById(transaction.uid).remove();
//         })
//         .catch(error => {
//             hideLoading();
//             console.log(error);
//             alert('Erro ao remover transaçao');
//         })
// }

function formatDate(dateStr) {
    const [year, month, day] = dateStr.split("-");
    const localDate = new Date(year, month - 1, day); // mês começa em 0
    return localDate.toLocaleDateString('pt-BR');
}


function formatMoney(money) {
    return `${money.currency} ${money.value.toFixed(2)}`
}

let transactionChartInstance = null;

function applyFilters() {
  const user = firebase.auth().currentUser;
  if (user) {
    renderTransactionChart(user.uid);
  }
}

function renderTransactionChart(uid) {
  const currencyFilter = document.getElementById("filterCurrency").value;
  const typeFilter = document.getElementById("filterType").value;
  const startDate = document.getElementById("filterStartDate").value;
  const endDate = document.getElementById("filterEndDate").value;

  let query = firebase.firestore()
    .collection('transactions')
    .where('user.uid', '==', uid)
    .orderBy('date');

  query.get().then(snapshot => {
    const incomeData = {};
    const expenseData = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();

      const date = data.date;
      const value = data.money.value;
      const type = data.type;
      const currency = data.money.currency;

      // Filtros aplicados
      if (currencyFilter && currency !== currencyFilter) return;
      if (typeFilter && type !== typeFilter) return;
      if (startDate && date < startDate) return;
      if (endDate && date > endDate) return;

      if (type === 'income') {
        incomeData[date] = (incomeData[date] || 0) + value;
      } else if (type === 'expense') {
        expenseData[date] = (expenseData[date] || 0) + value;
      }
    });

    const labels = Array.from(new Set([
      ...Object.keys(incomeData),
      ...Object.keys(expenseData)
    ])).sort();

    const incomeValues = labels.map(date => incomeData[date] || 0);
    const expenseValues = labels.map(date => expenseData[date] || 0);

    // Remove gráfico anterior, se houver
    if (transactionChartInstance) {
      transactionChartInstance.destroy();
    }

    const ctx = document.getElementById('transactionChart').getContext('2d');
    transactionChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Receitas',
            data: incomeValues,
            borderColor: 'green',
            backgroundColor: 'rgba(0, 128, 0, 0.1)',
            tension: 0.4
          },
          {
            label: 'Despesas',
            data: expenseValues,
            borderColor: 'red',
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Data'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Valor (R$)'
            }
          }
        }
      }
    });
  }).catch(error => {
    console.error('Erro ao carregar dados para o gráfico:', error);
  });
}

firebase.auth().onAuthStateChanged(user => {
  if (user) {
    window.onload = () => renderTransactionChart(user.uid);
  }
});
