import {autoinject} from 'aurelia-framework';
import {HttpClient, json} from 'aurelia-fetch-client';
import 'fetch';
import {Network, Graph, Direction, ComponentFactory, Kind, Node, RunState} from 'cryptographix-sim-core';
import { ByteArrayEntry } from './components/bytearray-entry';
import { ByteArrayViewer } from './components/bytearray-viewer';
import { CryptoBox } from './components/crypto-box';
import { EMVCardSimulator } from './components/emv-card-simulator';
import { APDUSender } from './components/apdu-sender';
import { NetworkConfigDialog } from './config-dialogs/network-config-dialog';
import { DialogService } from 'aurelia-dialog';

@autoinject
export class MyNetworks {
 
  network: Network;
  networks = [];
  components: {};
  label: string;
  graphSelected: boolean;
  dialogService: DialogService;
  fetchCalled: boolean;
  isSaving: boolean = false;

  // to be passed to the thumbnail so deleteNetwork and loadNetwork can be called
  self = this;
 
  constructor(private http: HttpClient, dialogService: DialogService) {
    http.configure(config => {
      config
        .useStandardConfiguration()
        .withBaseUrl('http://localhost:8080/api/')
        .withDefaults({
          headers: {
            'authorization': localStorage.getItem('jwt')
          }
        })
    });
    
    this.http = http;
    this.fetchNetworks();
    this.label = "My Networks";
    this.dialogService = dialogService
  }

  attached() {

    // offset according to the width and height of the text
    document.getElementById('page-title').style.marginLeft = "-280px";
    document.getElementById('page-title').style.marginTop = "-40px";

    /* 
     * attached and fetchNetworks get called in a different order depending
     * on whether the page is loaded/refreshed, or transitioned to from another
     * page, therefore the fetchCalled boolean is needed
     */
    if (this.fetchCalled && this.networks.length === 0) {
      document.getElementById("newNetworkButton").classList.add("pulse");
    }
  }

  fetchNetworks() {
    return this.http.fetch('getUserNetworks', {
        method: 'get'
    }).then(response => response.json())
      .then(data => {
        this.fetchCalled = true;
        if (data.length === 0)
          document.getElementById("newNetworkButton").classList.add("pulse");
        for (var network of data)
          this.configureNetwork(network);
      }); 
  }

  configureNetwork(network: any) {
    let graph = new Graph(null, network.graph);
    let factory = new ComponentFactory();
    factory.register( 'ByteArrayEntry', ByteArrayEntry );
    factory.register( 'ByteArrayViewer', ByteArrayViewer );
    factory.register( 'CryptoBox', CryptoBox );
    factory.register( 'EMVCardSimulator', EMVCardSimulator);
    factory.register('APDUSender', APDUSender);

    graph.nodes.forEach(node => { this.configureNode(node, network.graph) });
    this.networks.push(new Network(factory, graph));
  }

  loadNetwork(network: Network) {
    this.network = network;
    // the network object is then bound to the canvas custom element in the view
    this.label = this.network.graph.id;
    this.graphSelected = true;
  }

  back() {
    if (this.network.graph.context.runState === RunState.RUNNING)
      this.network.stop();
    this.graphSelected = false;
    this.label = "My Networks";
  }

  save(network: Network) {
    this.isSaving = true;
    this.http.fetch('updateNetwork', {
      method: 'post',
      body: json(this.network.graph.toObject({}))
    }).then(response => response.json())
      .then(data => {
        console.log(data);
        this.isSaving = false;
      });
  }

  saveNewGraph(graph: {}) {
    this.http.fetch('addNetwork', {
      method: 'post',
      body: json(graph)
    }).then(response => response.json())
      .then(data => {
        console.log(data); 
    });
  }

  newNetwork() {
    document.getElementById("newNetworkButton").classList.remove("pulse");
    this.dialogService.open({ viewModel: NetworkConfigDialog, model: this.getTakenNames() }).then(response => {
      if (!response.wasCancelled) {
        let network = { graph: { "id": response.output } };
        this.configureNetwork(network);
        this.saveNewGraph(network.graph);
      }
    });
  }

  deleteNetwork(network: Network) {
    this.http.fetch('deleteNetwork', {
      method: 'delete',
      body: json(network.graph.toObject({}))
    }).then(response => response.json())
      .then(data => {
        this.networks.splice(this.networks.indexOf(network), 1);
    });
  }

  configureNode(node: Node, graph: any) {
    node.metadata["view"] = {
      x: graph.nodes[node.id].metadata.view.x,
      y: graph.nodes[node.id].metadata.view.y,
      width: graph.nodes[node.id].metadata.view.width,
      height: graph.nodes[node.id].metadata.view.height
    }
  }

  getTakenNames() {
    var takenNames = [];
    this.networks.forEach(network => {
      takenNames.push(network.graph.id);
    });
    return takenNames;
  }

  // temporary function to enable testing of graph modifications
  printGraphObject() {
    console.log(this.network.graph.toObject({}));
  }

}	

