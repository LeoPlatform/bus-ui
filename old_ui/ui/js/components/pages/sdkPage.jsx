import React from 'react'
import {observer, inject} from 'mobx-react'
import DropDown from '../elements/dropDown.jsx'
import Nodejs from '../sdkLangs/nodejs.jsx';
import Php from '../sdkLangs/php.jsx';

@inject('dataStore')
@observer
export default class sdkPage extends React.Component {

    constructor(props) {
        super(props);
        this.dataStore = this.props.dataStore;
    }

    renderLang() {
        switch (this.dataStore.sdkPick) {
            case 'node':
                return <Nodejs/>;

            case 'php':
                return <Php/>;

            default:
                return false;
        }
    };

    render() {
        console.log('Datastore: ', this.dataStore);
        return (
            <div>
                <DropDown/>
                {this.renderLang()}
            </div>
        )
    }
}
