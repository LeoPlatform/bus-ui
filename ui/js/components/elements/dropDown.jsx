import React from 'react';
import {observer, inject} from 'mobx-react';

@inject('dataStore')
@observer
export default class DropDown extends React.Component {
    constructor(props) {
        super(props);
        this.dataStore = this.props.dataStore;
    }

    handleChange = (e) => {
        this.dataStore.sdkPick = e.target.value;
    };

    render() {
        return (
            <div>
                Pick a Langauge...
                <br/>
                <select
                    name={'picking'}
                    id={'picking'}
                    onChange={this.handleChange}
                >
                    <option value="node">NodeJs</option>
                    <option value="php">PHP</option>
                </select>
            </div>
        )
    };
};
